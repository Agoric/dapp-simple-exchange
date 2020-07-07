import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

export default harden(({ publicAPI, keywords, brandPs, http, board, inviteIssuer }, _inviteMaker) => {
  const subChannelHandles = new Set();
  const bookNotifierP = E(publicAPI).getNotifier();

  const brandToKeyword = new Map();
  keywords.forEach(async (keyword, i) => {
    const brand = await brandPs[i];
    brandToKeyword.set(brand, keyword);
  });

  E(bookNotifierP).getUpdateSince().then(orders => {
    handleBookOrderUpdate(orders);

  });
  let recentOrders;

  const jsonAmount = ({ extent, brand }) =>
    ({ extent, keyword: brandToKeyword.get(brand) });

  const jsonOrders = orders => orders.map(({
    give: {
      Asset: giveAsset,
      Price: givePrice,
    },
    want: {
      Asset: wantAsset,
      Price: wantPrice,
    },
  }) => {
    return {
      Asset: jsonAmount(wantAsset || giveAsset),
      Price: jsonAmount(wantPrice || givePrice),
    };
  });

  // send a stream of updates to the complete list of book orders via calls to
  // updateRecentOrdersOnChange()
  function handleBookOrderUpdate({ value, updateHandle, done }) {
    if (done) {
      return;
    }

    const bookOrders = {};
    Object.entries(value).forEach(([direction, rawOrders]) => {
      bookOrders[direction] = jsonOrders(rawOrders);
      // bookOrders[`${direction}History`] = jsonOrders(history[direction] || []);
    });

    updateRecentOrdersOnChange(bookOrders);
    E(bookNotifierP).getUpdateSince(updateHandle).then(orders =>
      handleBookOrderUpdate(orders));
  }

  function updateRecentOrdersOnChange(newRecentOrders) {
    // Save the recent order.
    recentOrders = newRecentOrders;

    const obj = {
      type: 'simpleExchange/getRecentOrdersResponse',
      data: recentOrders,
    };

    E(http).send(obj, [...subChannelHandles.keys()])
      .catch(e => console.error('cannot send for', e));
  }

  async function subscribeRecentOrders(channelHandle) {
    // Send the latest response.
    const obj = {
      type: 'simpleExchange/getRecentOrdersResponse',
      data: recentOrders,
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
              return harden({
                type: 'simpleExchange/getRecentOrdersResponse',
                data: recentOrders,
              });
            }

            case 'simpleExchange/subscribeRecentOrders': {
              subscribeRecentOrders(channelHandle);
              return harden({
                type: 'simpleExchange/subscribeRecentOrdersResponse',
                data: true,
              });
            }

            case 'simpleExchange/sendInvite': {
              const { depositFacetId, offer } = obj.data;
              const depositFacet = E(board).getValue(depositFacetId);
              const invite = await E(publicAPI).makeInvite();
              const inviteAmount = await E(inviteIssuer).getAmountOf(invite);
              E(depositFacet).receive(invite);
              const { extent: [{ handle }]} = inviteAmount;
              const inviteHandleBoardId = await E(board).getId(handle);
              const updatedOffer = { ...offer, inviteHandleBoardId };
              
              return harden({
                type: 'simpleExchange/sendInviteResponse',
                data: { offer: updatedOffer },
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
