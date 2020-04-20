import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

export default harden(({ publicAPI, http }, _inviteMaker) => {
  const subChannelHandles = new Set();
  const bookNotifierP = E(publicAPI).getNotifier();

  E(bookNotifierP).getUpdateSince().then(orders => {
    debugger;
    handleBookOrderUpdate(orders);

  });
  let recentOrders;

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

  // send a stream of updates to the complete list of book orders via calls to
  // updateRecentOrdersOnChange()
  function handleBookOrderUpdate({ value, updateHandle, done }) {
    debugger;
    if (done) {
      return;
    }

    const bookOrders = {};
    Object.entries(value).forEach(([direction, rawOrders]) => {
      bookOrders[direction] = rawOrders;
      // bookOrders[`${direction}History`] = jsonOrders(history[direction] || []);
    });

    updateRecentOrdersOnChange(bookOrders);
    E(bookNotifierP).getUpdateSince(updateHandle).then(orders =>
      handleBookOrderUpdate(orders));
  }

  function updateRecentOrdersOnChange(newRecentOrders) {
    // Save the recent order.
    recentOrders = newRecentOrders;

    const { changed, ...rest } = recentOrders;
    const obj = {
      type: 'simpleExchange/getRecentOrdersResponse',
      data: rest,
    };

    E(http).send(obj, [...subChannelHandles.keys()])
      .catch(e => console.error('cannot send for', e));
  }

  async function subscribeRecentOrders(channelHandle) {
    // Send the latest response.
    const { changed, ...rest } = recentOrders;
    const obj = {
      type: 'simpleExchange/getRecentOrdersResponse',
      data: rest,
    };

    E(http).send(obj, [channelHandle])
      .catch(e => console.error('cannot send', e));
    return true;
  }

  return harden({
    getCommandHandler() {
      const handler = {
        onError(obj, _meta) {
          console.error('Have error', obj);
        },
        onOpen(_obj, { channelHandle }) {
          subChannelHandles.add(channelHandle);
        },
        onClose(_obj, { channelHandle }) {
          subChannelHandles.delete(channelHandle);
        },
        async onMessage(obj, { channelHandle }) {
          console.debug(obj);
          switch (obj.type) {
            case 'simpleExchange/getRecentOrders': {
              const { changed, ...rest } = recentOrders;
              return harden({
                type: 'simpleExchange/getRecentOrdersResponse',
                data: rest,
              });
            }

            case 'simpleExchange/subscribeRecentOrders': {
              subscribeRecentOrders(channelHandle);
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
