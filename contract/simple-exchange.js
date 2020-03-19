import { assert, details } from '@agoric/assert';
import harden from '@agoric/harden';
import makePromise from '@agoric/make-promise';
import makeStore from '@agoric/store';
import { makeHelpers, defaultAcceptanceMsg } from '@agoric/zoe/src/contracts/helpers/userFlow';

/**  EDIT THIS CONTRACT WITH YOUR OWN BUSINESS LOGIC */

/**
 * This contract is like the @agoric/zoe/src/contracts/simpleExchange.js contract.
 * The exchange only accepts limit orders. A limit order is an order with payoutRules
 * that specifies wantAtLeast on one side and offerAtMost on the other:
 * [ { kind: 'wantAtLeast', amount: amount2 }, { kind: 'offerAtMost', amount: amount1 }]
 * [ { kind: 'wantAtLeast', amount: amount1 }, { kind: 'offerAtMost', amount: amount2 }]
 *
 * Note that the asset specified as wantAtLeast is treated as the exact amount
 * to be exchanged, while the amount specified as offerAtMost is a limit that
 * may be improved on. This simple exchange does not partially fill orders.
 */
export const makeContract = harden((zoe, terms) => {
  const ASSET_INDEX = 0;
  let sellInviteHandles = [];
  let buyInviteHandles = [];
  let nextChangePromise = makePromise();

  const keyToInviteHandle = makeStore();
  const inviteHandleToKey = makeStore();

  const { issuers } = terms;
  const {
    rejectOffer,
    hasValidPayoutRules,
    swap,
    areAssetsEqualAtIndex,
    canTradeWith,
    getActiveOffers,
  } = makeHelpers(zoe, issuers);

  function flattenRule(r) {
    switch (r.kind) {
      case 'offerAtMost':
        return { offer: r.amount };
      case 'wantAtLeast':
        return { want: r.amount };
      default:
        throw new Error(`${r.kind} not supported.`);
    }
  }

  function flattenOffer(o) {
    inviteHandleToKey
    return harden([
      flattenRule(o.payoutRules[0]),
      flattenRule(o.payoutRules[1]),
    ]);
  }

  function keyedOrders(offerHandles) {
    const activeOfferHandles = zoe.getOfferStatuses(offerHandles).active;
    return zoe
      .getOffers(activeOfferHandles)
      .map((offer, i) => {
        const key = inviteHandleToKey.get(activeOfferHandles[i]);
        const flatOffer = flattenOffer(offer);
        return harden([key, ...flatOffer]);
      });
  }

  function getBookOrders() {
    return {
      changed: nextChangePromise.p,
      buys: keyedOrders(buyInviteHandles),
      sells: keyedOrders(sellInviteHandles),
    };
  }

  function getOrderStatus(inviteHandles) {
    const requested = new Set(inviteHandles);
    return {
      buys: keyedOrders(buyInviteHandles.filter(requested.has)),
      sells: keyedOrders(sellInviteHandles.filter(requested.has)),
    }
  }

  function getOffer(inviteHandle) {
    if (
      sellInviteHandles.includes(inviteHandle) ||
      buyInviteHandles.includes(inviteHandle)
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
    // Make note of the changes we did.
    bookOrdersChanged();
    for (const iHandle of inviteHandles) {
      if (
        areAssetsEqualAtIndex(ASSET_INDEX, inviteHandle, iHandle) &&
        canTradeWith(inviteHandle, iHandle)
      ) {
        // Publish the orders again when we get the results of the swap.
        return swap(inviteHandle, iHandle).finally(bookOrdersChanged);
      }
    }
    return defaultAcceptanceMsg;
  }

  const makeInvite = inviteKey => {
    assert(typeof inviteKey === 'string', details`Invite key ${inviteKey} must be a string`);

    const seat = harden({
      // This code might be modified to support immediate_or_cancel. Current
      // implementation is effectively fill_or_kill.
      addOrder: () => {
        // Is it a valid sell offer?
        if (hasValidPayoutRules(['offerAtMost', 'wantAtLeast'], inviteHandle)) {
          // Save the valid offer and try to match

          // IDEA: to implement matching against the best price, the orders
          // should be sorted. (We'd also want to allow partial matches.)
          sellInviteHandles.push(inviteHandle);
          buyInviteHandles = [...zoe.getOfferStatuses(buyInviteHandles).active];
          return swapOrAddToBook(buyInviteHandles, inviteHandle);
        }
        // Is it a valid buy offer?
        if (hasValidPayoutRules(['wantAtLeast', 'offerAtMost'], inviteHandle)) {
          // Save the valid offer and try to match
          buyInviteHandles.push(inviteHandle);
          sellInviteHandles = [
            ...zoe.getOfferStatuses(sellInviteHandles).active,
          ];
          return swapOrAddToBook(sellInviteHandles, inviteHandle);
        }
        // Eject because the offer must be invalid
        throw rejectOffer(inviteHandle);
      },
    });

    const { invite, inviteHandle } = zoe.makeInvite(seat, { seatDesc: 'addOrder' });

    keyToInviteHandle.init(inviteKey, inviteHandle);
    inviteHandleToKey.init(inviteHandle, inviteKey);

    return { invite, inviteHandle };
  };

  return harden({
    invite: makeInvite('bootstrap'),
    publicAPI: { makeInvite, getBookOrders, getOrderStatus, getOffer },
    terms,
  });
});
