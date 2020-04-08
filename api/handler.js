import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

// This javascript source file uses the "tildot" syntax (foo~.bar()) for
// eventual sends.
// https://agoric.com/documentation/ertp/guide/other-concepts.html
//  Tildot is standards track with TC39, the JavaScript standards committee.
// https://github.com/tc39/proposal-wavy-dot

export default harden(({adminSeats, brands, brandRegKeys, zoe, registrar, http, overrideInstanceId = undefined}, _inviteMaker) => {
  // If we have an overrideInstanceId, use it to assert the correct value in the RPC.
  function coerceInstanceId(instanceId = undefined) {
    if (instanceId === undefined) {
      return overrideInstanceId;
    }
    if (overrideInstanceId === undefined || instanceId === overrideInstanceId) {
      return instanceId;
    }
    throw TypeError(`instanceId ${JSON.stringify(instanceId)} must match ${JSON.stringify(overrideInstanceId)}`);
  }

  const orderHistory = new Map();

  const brandToBrandRegKey = new Map();
  Object.entries(brands).forEach(([keyword, brand]) =>
    brandToBrandRegKey.set(brand, brandRegKeys[keyword]));

  const registrarPCache = new Map();
  function getRegistrarP(id) {
    let regP = registrarPCache.get(id);
    if (!regP) {
      // Cache miss, so try the registrar.
      regP = E(registrar).get(id);
      registrarPCache.set(id, regP);
    }
    return regP;
  }

  const instancePCache = new Map();
  function getInstanceP(id) {
    let instanceP = instancePCache.get(id);
    if (!instanceP) {
      const instanceHandleP = getRegistrarP(id);
      instanceP = instanceHandleP.then(instanceHandle =>
        E(zoe).getInstance(instanceHandle));
      instancePCache.set(id, instanceP);
    }
    return instanceP;
  }

  const historyChangedPromises = new Map();
  function handleNotifyStream(history, instanceRegKey) {
    if (!adminSeats[instanceRegKey]) {
      return;
    }

    historyChangedPromises.set(instanceRegKey, producePromise());

    const firstP = adminSeats[instanceRegKey]~.getHandleNotifyP();
    const already = new Set();
    const handleNotify = notify => {
      const { nextP, inactive = [] } = notify;
      for (const completed of ['fulfilled', 'matched']) {
        (notify[completed] || []).forEach(offerState => {
          const { inviteHandle, state } = offerState;
          already.add(inviteHandle);
          const stats = history[state];
          if (stats) {
            // A fulfilled or matched order.
            stats.push({ ...offerState, state: completed });
          }
        });
      }
      inactive.forEach(offerState => {
        const { inviteHandle, state } = offerState;
        if (already.has(inviteHandle)) {
          already.delete(inviteHandle);
        } else {
          const stats = history[state];
          if (stats) {
            // A cancelled order.
            stats.push({ ...offerState, state: 'cancelled' });
          }
        }
      });
      // Resolve the last historyChanged promise.
      const historyChanged = historyChangedPromises.get(instanceRegKey);
      historyChangedPromises.set(instanceRegKey, producePromise());
      historyChanged.resolve();
      nextP.then(handleNotify);
    };
    firstP.then(handleNotify);
  }

  let lastHandleID = 0;
  const inviteHandleToID = new Map();
  async function getJSONBookOrders(instanceRegKey) {
    const { publicAPI } = await getInstanceP(instanceRegKey);
    const bookOrHistoryChanged = producePromise();

    let history = orderHistory.get(instanceRegKey);
    if (!history) {
      // Default to an empty history.
      history = { buy: [], sell: [] };
      orderHistory.set(instanceRegKey, history);

      // We try subscribing to the notification stream.
      handleNotifyStream(history, instanceRegKey);
    }

    const historyChanged = historyChangedPromises.get(instanceRegKey);
    if (historyChanged) {
      historyChanged.promise.then(bookOrHistoryChanged.resolve, bookOrHistoryChanged.reject);
    }

    const { changed, ...rest } = await E(publicAPI).getBookOrders();
    changed.then(bookOrHistoryChanged.resolve, bookOrHistoryChanged.reject);

    const bookOrders = { changed: bookOrHistoryChanged.promise };
    const jsonAmount = ({ extent, brand }) =>
      ({ extent, brandRegKey: brandToBrandRegKey.get(brand) });
    const jsonOrders = orders => orders.map(({
      inviteHandle,
      state,
      proposal: {
        give: {
          Asset: giveAsset,
          Price: givePrice,
        },
        want: {
          Asset: wantAsset,
          Price: wantPrice,
        },
      },
    }) => {
      let publicID = inviteHandleToID.get(inviteHandle);
      if (!publicID) {
        lastHandleID += 1;
        publicID = lastHandleID;
        inviteHandleToID.set(inviteHandle, publicID);
      }
      return {
        publicID,
        state,
        Asset: jsonAmount(wantAsset || giveAsset),
        Price: jsonAmount(wantPrice || givePrice),
      }; 
    });
      
    Object.entries(rest).forEach(([direction, rawOrders]) => {
      bookOrders[direction] = jsonOrders(rawOrders);
      bookOrders[`${direction}History`] = jsonOrders(history[direction] || []);
    });

    return bookOrders;
  }

  const instanceToRecentOrders = new Map();
  const subscribedInstances = new Map();
  const loadingOrders = new Map();
  const subscribers = new Map();
  function updateRecentOrdersOnChange(instanceRegKey, recentOrders) {
    // Save the recent order.
    instanceToRecentOrders.set(instanceRegKey, recentOrders);

    // Resubscribe.
    recentOrders.changed
      .then(() => getJSONBookOrders(instanceRegKey))
      .then(order => updateRecentOrdersOnChange(instanceRegKey, order));

    // Publish to our subscribers.
    const subs = subscribers.get(instanceRegKey);
    if (!subs) {
      return;
    }

    const { changed, ...rest } = recentOrders;
    const obj = {
      type: 'simpleExchange/getRecentOrdersResponse',
      data: rest,
    };

    E(http).send(obj, [...subs.keys()])
      .catch(e => console.error('cannot send for', instanceRegKey, e));
  }

  function ensureRecentOrdersSubscription(instanceRegKey) {
    let loadingP = loadingOrders.get(instanceRegKey);
    if (loadingP) {
      return loadingP;
    }

    // Start the subscription.
    const pr = producePromise();
    loadingOrders.set(instanceRegKey, pr.promise);
    loadingP = pr.promise;
    getJSONBookOrders(instanceRegKey).then(order => {
      updateRecentOrdersOnChange(instanceRegKey, order);
      pr.resolve();
    }, pr.reject);

    loadingP.catch(e => console.error('Error loading', instanceRegKey, e));
    return loadingP;
  }

  async function getRecentOrders(instanceRegKey) {
    await ensureRecentOrdersSubscription(instanceRegKey);
    return instanceToRecentOrders.get(instanceRegKey);
  }

  async function subscribeRecentOrders(instanceRegKey, channelHandle) {
    const { changed, ...rest } = await getRecentOrders(instanceRegKey);

    let subs = subscribers.get(instanceRegKey);
    if (!subs) {
      subs = new Set();
      subscribers.set(instanceRegKey, subs);
    }
    subs.add(channelHandle);

    // Send the latest response.
    const obj = {
      type: 'simpleExchange/getRecentOrdersResponse',
      instanceRegKey,
      data: rest,
    };

    E(http).send(obj, [channelHandle])
      .catch(e => console.error('cannot send for', instanceRegKey, e));
    return true;
  }

  if (overrideInstanceId) {
    ensureRecentOrdersSubscription(overrideInstanceId)
      .catch(e => console.error('cannot subscribe to', overrideInstanceId, e));
  }

  return harden({
    getCommandHandler() {
      const handler = {
        onError(obj, _meta) {
          console.error('Have error', obj);
        },
        onOpen(_obj, { channelHandle }) {
          subscribedInstances.set(channelHandle, new Set());
        },
        onClose(_obj, { channelHandle }) {
          const instances = subscribedInstances.get(channelHandle);
          if (instances) {
            for (const instanceId of instances.keys()) {
              const subs = subscribers.get(instanceId);
              if (subs) {
                // Clean up the subscriptions from the list.
                subs.delete(channelHandle);
              }
            }
          }
          subscribedInstances.delete(channelHandle);
        },
        async onMessage(obj, { channelHandle } = {}) {
          switch (obj.type) {
            case 'simpleExchange/getRecentOrders': {
              const { instanceRegKey } = obj;
              const instanceId = coerceInstanceId(instanceRegKey);

              const { changed, ...rest } = await getRecentOrders(instanceId);

              return harden({
                type: 'simpleExchange/getRecentOrdersResponse',
                instanceRegKey,
                data: rest,
              });
            }

            case 'simpleExchange/subscribeRecentOrders': {
              const { instanceRegKey } = obj;
              const instanceId = coerceInstanceId(instanceRegKey);

              if (!channelHandle) {
                throw Error(`Channel is not set for ${instanceId} subscription`);
              }

              const subs = subscribedInstances.get(channelHandle);
              if (!subs) {
                throw Error(`Subscriptions not initialised for channel ${channelHandle}`);
              }

              if (subs.has(instanceId)) {
                return harden({
                  type: 'simpleExchange/subscribeRecentOrdersResponse',
                  data: 'already',
                });
              }

              subs.add(instanceId);
              subscribeRecentOrders(instanceId, channelHandle);

              return harden({
                type: 'simpleExchange/subscribeRecentOrdersResponse',
                data: true,
              });
            }

            default:
              return undefined;
          }
        },
      };
      return harden(handler);
    },
  });
});
