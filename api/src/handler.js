import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

export default harden(({ registry, brandPs, keywords, publicAPI }, _inviteMaker) => {

  const jsonAmount = ({ extent, brand }) =>
    ({ extent, brandRegKey: brandToBrandRegKey.get(brand) });

  let lastHandleID = 0;
  const inviteHandleToID = new Map();
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

  const bookNotifiers = new Map();
  // send a stream of updates to the complete list of book orders via calls to
  // updateRecentOrdersOnChange()
  function handleBookorderUpdate(instanceRegKey, { state, updateHandle, done }) {
    if (done) {
      return;
    }

    const bookOrders = {};
    Object.entries(state).forEach(([direction, rawOrders]) => {
      bookOrders[direction] = jsonOrders(rawOrders);
      bookOrders[`${direction}History`] = jsonOrders(history[direction] || []);
    });

    updateRecentOrdersOnChange(instanceRegKey, bookOrders);
    const bookNotiferP = bookNotifiers.get(instanceRegKey);
    E(bookNotiferP).getUpdateSince(updateHandle).then(orders =>
      handleBookorderUpdate(instanceRegKey, orders));
  }

  const instanceToRecentOrders = new Map();
  const subscribedInstances = new Map();
  const subscribers = new Map();
  function updateRecentOrdersOnChange(instanceRegKey, recentOrders) {
    // Save the recent order.
    instanceToRecentOrders.set(instanceRegKey, recentOrders);

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
    const bookNotiferP = E(publicAPI).getNotifier();
    bookNotifiers.init(instanceRegKey, bookNotiferP);
    E(bookNotiferP).getUpdateSince().then(orders =>
      handleBookorderUpdate(instanceRegKey, orders));

    return loadingP;
  }

  async function getRecentOrders(instanceRegKey) {
    await ensureRecentOrdersSubscription(instanceRegKey);
    return instanceToRecentOrders.get(instanceRegKey);
  }

  async function subscribeRecentOrders(instanceRegKey, channelHandle) {
    const orders = await getRecentOrders(instanceRegKey);

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
      data: orders,
    };

    E(http).send(obj, [channelHandle])
      .catch(e => console.error('cannot send for', instanceRegKey, e));
    return true;
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
