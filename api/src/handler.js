import { E } from '@agoric/eventual-send';

export default harden(
  (
    { publicFacet, keywords, brandPs, http, board, invitationIssuer },
    _invitationMaker,
  ) => {
    const subChannelHandles = new Set();
    const bookNotifierP = E(publicFacet).getNotifier();

    const brandToKeyword = new Map();
    keywords.forEach(async (keyword, i) => {
      const brand = await brandPs[i];
      brandToKeyword.set(brand, keyword);
    });

    E(bookNotifierP)
      .getUpdateSince()
      .then(orders => {
        // eslint-disable-next-line no-use-before-define
        handleBookOrderUpdate(orders);
      });
    let recentOrders;

    const jsonAmount = ({ value, brand }) => ({
      value,
      keyword: brandToKeyword.get(brand),
    });

    const jsonOrders = orders =>
      orders.map(
        ({
          give: { Asset: giveAsset, Price: givePrice },
          want: { Asset: wantAsset, Price: wantPrice },
        }) => {
          return {
            Asset: jsonAmount(wantAsset || giveAsset),
            Price: jsonAmount(wantPrice || givePrice),
          };
        },
      );

    // send a stream of updates to the complete list of book orders via calls to
    // updateRecentOrdersOnChange()
    function handleBookOrderUpdate({ value, updateCount }) {
      if (updateCount === undefined) {
        return;
      }

      const bookOrders = {};
      Object.entries(value).forEach(([direction, rawOrders]) => {
        bookOrders[direction] = jsonOrders(rawOrders);
        // bookOrders[`${direction}History`] = jsonOrders(history[direction] || []);
      });

      // eslint-disable-next-line no-use-before-define
      updateRecentOrdersOnChange(bookOrders);
      E(bookNotifierP)
        .getUpdateSince(updateCount)
        .then(orders => handleBookOrderUpdate(orders));
    }

    function updateRecentOrdersOnChange(newRecentOrders) {
      // Save the recent order.
      recentOrders = newRecentOrders;

      const obj = {
        type: 'simpleExchange/getRecentOrdersResponse',
        data: recentOrders,
      };

      E(http)
        .send(obj, [...subChannelHandles.keys()])
        .catch(e => console.error('cannot send for', e));
    }

    async function subscribeRecentOrders(channelHandle) {
      // Send the latest response.
      const obj = {
        type: 'simpleExchange/getRecentOrdersResponse',
        data: recentOrders,
      };

      E(http)
        .send(obj, [channelHandle])
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

              case 'simpleExchange/sendInvitation': {
                const { depositFacetId, offer } = obj.data;
                const depositFacet = E(board).getValue(depositFacetId);
                const invitation = await E(publicFacet).makeInvitation();
                const invitationAmount = await E(invitationIssuer).getAmountOf(
                  invitation,
                );
                const {
                  value: [{ handle }],
                } = invitationAmount;
                const invitationHandleBoardId = await E(board).getId(handle);
                const updatedOffer = { ...offer, invitationHandleBoardId };
                // We need to wait for the invitation to be
                // received, or we will possibly win the race of
                // proposing the offer before the invitation is ready.
                // TODO: We should make this process more robust.
                await E(depositFacet).receive(invitation);

                return harden({
                  type: 'simpleExchange/sendInvitationResponse',
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
  },
);
