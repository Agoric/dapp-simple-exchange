import harden from '@agoric/harden';

export default harden(({zoe, registrar, overrideInstanceId = undefined}, _inviteMaker) => {
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

  async function getBookOrders(instanceRegKey) {
    const { publicAPI } = await getInstanceP(instanceRegKey);
    return E(publicAPI).getBookOrders(inviteHandles);
  }

  const recentOrders = new Map();
  const loadingOrders = new Map();
  const subscribers = new Map();
  function updateRecentOrdersOnChange(instanceRegKey, recentOrder) {
    // Save the recent order.
    recentOrders.set(instanceRegKey, recentOrder);

    // Resubscribe.
    recentOrder.change.then(order =>
      updateRecentOrdersOnChange(instanceRegKey, order));

    // Publish to our subscribers.
    const subs = subscribers.get(instanceRegKey);
    if (!subs) {
      return;
    }
    for (const sub of subs.keys()) {
      try {
        sub(recentOrder);
      } catch (e) {
        console.error('error writing to order subscription');
        subs.delete(sub);
      }
    }
  }

  function ensureRecentOrdersSubscription(instanceRegKey) {
    let loadingP = loadingOrders.get(instanceRegKey);
    if (loadingP) {
      return loadingP;
    }

    // Start the subscription.
    const pr = makePromise();
    loadingOrders.set(instanceRegKey, pr.p);
    loadingP = pr.p;
    getBookOrders(instanceRegKey).then(order => {
      updateRecentOrdersOnChange(instanceRegKey, order);
      pr.res();
    }, pr.rej);

    loadingP.catch(e => console.error('Error loading', instanceRegKey, e));
    return loadingP;
  }

  async function getRecentOrders(instanceRegKey) {
    await ensureRecentOrdersSubscription(instanceRegKey);
    return recentOrders.get(instanceRegKey);
  }

  function subscribeRecentOrders(instanceRegKey, sub) {
    ensureRecentOrdersSubscription(instanceRegKey);
    let subs = subscribers.get(instanceRegKey);
    if (!subs) {
      subs = new WeakSet();
      subscribers.set(instanceRegKey, subs);
    }
    subs.add(sub);
    return true;
  }

  return harden({
    getCommandHandler() {
      return harden({
        async onConnect(connection) {
          console.info('have new connection', connection);
          subscribedConnections.set(connection, new Map());
        },
        async onDisconnect(connection) {
          console.info('disconnecting connection', connection);
          const instanceSub = subscribedConnections.get(connection);
          for (const [instanceId, sub] of instanceSub.entries()) {
            const subs = subscribers.get(instanceId);
            if (subs) {
              // Clean up the subscriptions from the list.
              subs.delete(sub);
            }
          }
          subscribedConnections.delete(connection);
        },
        async processInbound(obj, _home, connection) {
          switch (obj.type) {
            case 'simpleExchange/getRecentOrders': {
              const { instanceRegKey } = obj;
              const instanceId = coerceInstanceId(instanceRegKey);

              const { buys, sells } = await getRecentOrders(instanceId);

              return harden({
                type: 'simpleExchange/recentOrders',
                data: { buys, sells },
              });
            }

            case 'simpleExchange/subscribeRecentOrders': {
              const { instanceRegKey } = obj;
              const instanceId = coerceInstanceId(instanceRegKey);

              if (!connection) {
                throw Error(`Connection is not set for ${instanceId} subscription`);
              }

              const subs = subscribedConnections.get(connection);
              if (!subs) {
                throw Error(`Subscriptions not initialised for connection ${connection}`);
              }

              if (subs.has(instanceId)) {
                return harden({
                  type: 'simpleExchange/subscribedToRecentOrders',
                  data: 'already',
                });
              }

              const sub = ({ buys, sells }) => {
                const obj = harden({
                  type: 'simpleExchange/recentOrders',
                  data: { buys, sells },
                });
                E(connection).send(obj);
              };

              subs.set(instanceId, sub);
              subscribeRecentOrders(instanceId, sub);

              return harden({
                type: 'simpleExchange/subscribedToRecentOrders',
                data: true,
              });
            }

            default:
              return undefined;
          }
        },
      });
    },
  });
});
