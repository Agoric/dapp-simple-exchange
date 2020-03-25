import harden from '@agoric/harden';
import { makeHelpers, defaultAcceptanceMsg } from '@agoric/zoe/src/contracts/helpers/userFlow';
import makePromise from '@agoric/make-promise';

/**  EDIT THIS CONTRACT WITH YOUR OWN BUSINESS LOGIC */

/**
 * This contract is like the simpleExchange contract. The exchange only accepts
 * limit orders. A limit order is an order with payoutRules that specifies
 * wantAtLeast on one side and offerAtMost on the other:
 * [ { kind: 'wantAtLeast', amount: amount2 }, { kind: 'offerAtMost', amount: amount1 }]
 * [ { kind: 'wantAtLeast', amount: amount1 }, { kind: 'offerAtMost', amount: amount2 }]
 *
 * Note that the asset specified as wantAtLeast is treated as the exact amount
 * to be exchanged, while the amount specified as offerAtMost is a limit that
 * may be improved on. This simple exchange does not partially fill orders.
 */
export const makeContract = harden((zoe, terms) => {
  const ASSET_INDEX = 0;
  const inviteHandleGroups = { buy: [], sell: [], buyHistory: [], sellHistory: [] }
  let nextChangePromise = makePromise();

  const { issuers } = terms;
  const {
    rejectOffer,
    hasValidPayoutRules,
    swap,
    areAssetsEqualAtIndex,
    canTradeWith,
    getActiveOffers,
  } = makeHelpers(zoe, issuers);

  function flattenRule(r, keyword) {
    switch (r.kind) {
      case 'offerAtMost':
        return { give: { [keyword]: r.amount } };
      case 'wantAtLeast':
        return { want: { [keyword]: r.amount } };
      default:
        throw new Error(`${r.kind} not supported.`);
    }
  }

  function flattenOffer(o) {
    return harden({
      ...flattenRule(o.payoutRules[0], 'Asset'),
      ...flattenRule(o.payoutRules[1], 'Price'),
    });
  }

  function flattenOrders(offerHandles) {
    const activeOffers = zoe.getOfferStatuses(offerHandles).active;
    const result = zoe
      .getOffers(activeOffers)
      .map((offer, i) => ({ inviteHandle: activeOffers[i], ...flattenOffer(offer) }));
    return result;
  }

  function getBookOrders() {
    return {
      changed: nextChangePromise.p,
      buy: flattenOrders(inviteHandleGroups.buy),
      sell: flattenOrders(inviteHandleGroups.sell),
      buyHistory: inviteHandleGroups.buyHistory,
      sellHistory:  inviteHandleGroups.sellHistory,
    };
  }

  function getOrderStatus(inviteHandles) {
    const requested = new Set(inviteHandles);
    return {
      buy: flattenOrders(inviteHandleGroups.buy.filter(requested.has)),
      sell: flattenOrders(inviteHandleGroups.sell.filter(requested.has)),
      buyHistory: flattenOrders(inviteHandleGroups.buyHistory.filter(requested.has)),
      sellHistory: flattenOrders(inviteHandleGroups.sellHistory.filter(requested.has)),
    }
  }

  function getOffer(inviteHandle) {
    if (
      inviteHandleGroups.sell.includes(inviteHandle) ||
      inviteHandleGroups.buy.includes(inviteHandle)
    ) {
      return flattenOffer(getActiveOffers([inviteHandle])[0]);
    }
    return 'not an active offer';
  }

  // This is a really simple update protocol, which merely provides a promise
  // in getBookOrders() that will resolve when the state changes. Clients
  // subscribe to the promise and are notified at some future point. A much
  // nicer protocol is in https://github.com/Agoric/agoric-sdk/issues/253
  function bookOrdersChanged() {
    nextChangePromise.res();
    nextChangePromise = makePromise();
  }


  function swapOrAddToBook(inviteHandles, inviteHandle) {
    bookOrdersChanged();
    for (const iHandle of inviteHandles) {
      if (
        areAssetsEqualAtIndex(ASSET_INDEX, inviteHandle, iHandle) &&
        canTradeWith(inviteHandle, iHandle)
      ) {
        return swap(inviteHandle, iHandle);
      }
    }
    return defaultAcceptanceMsg;
  }

  const makeInviteAndHandle = () => {
    const seat = harden({
      // This code might be modified to support immediate_or_cancel. Current
      // implementation is effectively fill_or_kill.
      addOrder: () => {
        // Is it a valid sell offer?
        if (hasValidPayoutRules(['offerAtMost', 'wantAtLeast'], inviteHandle)) {
          // Save the valid offer and try to match

          // IDEA: to implement matching against the best price, the orders
          // should be sorted. (We'd also want to allow partial matches.)
          inviteHandleGroups.sell.push(inviteHandle);
          inviteHandleGroups.buy = [...zoe.getOfferStatuses(inviteHandleGroups.buy).active];
          return swapOrAddToBook(inviteHandleGroups.buy, inviteHandle);
        }
        // Is it a valid buy offer?
        if (hasValidPayoutRules(['wantAtLeast', 'offerAtMost'], inviteHandle)) {
          // Save the valid offer and try to match
          inviteHandleGroups.buy.push(inviteHandle);
          inviteHandleGroups.sell = [
            ...zoe.getOfferStatuses(inviteHandleGroups.sell).active,
          ];
          return swapOrAddToBook(inviteHandleGroups.sell, inviteHandle);
        }
        // Eject because the offer must be invalid
        throw rejectOffer(inviteHandle);
      },
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat, { seatDesc: 'addOrder' });
    return { invite, inviteHandle };
  };

  const makeInvite = () => makeInviteAndHandle().invite;

  return harden({
    invite: makeInvite(),
    publicAPI: { makeInvite, getBookOrders, getOrderStatus, getOffer },
    terms,
  });
});
