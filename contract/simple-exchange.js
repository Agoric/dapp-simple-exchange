import { assert, details } from '@agoric/assert';
import harden from '@agoric/harden';
import makePromise from '@agoric/make-promise';
import makeStore from '@agoric/store';
import {
  makeHelpers,
  defaultAcceptanceMsg,
} from '@agoric/zoe/src/contracts/helpers/userFlow';

import { onHandlesExited } from './onHandlesExited';

/**  EDIT THIS CONTRACT WITH YOUR OWN BUSINESS LOGIC */

/**
 * This contract is like the @agoric/zoe/src/contracts/simpleExchange.js contract.
 * The exchange only accepts limit orders. A limit order is an order with a proposal
 * that specifies an Asset or Price to "give", and the opposite to "want"
 * { give: { Asset: simoleans(5) }, want: { Price: quatloos(3) } }
 * { give: { Price: quatloos(8) }, want: { Asset: simoleans(3) } }
 *
 * Note that the asset specified as "want" is treated as the exact amount
 * to be exchanged, while the amount specified as "give" is a limit that
 * may be improved on. This simple exchange does not partially fill orders.
 */
export const makeContract = harden((zoe, terms) => {
  const ASSET_INDEX = 0;
  const inviteHandles = { sell: [], buy: [] };
  let nextChangePromise = makePromise();

  const publicIDToInviteHandle = makeStore();
  const inviteHandleToPublicID = makeStore();

  const { issuers, timerService } = terms;
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
        return { give: r.amount };
      case 'wantAtLeast':
        return { want: r.amount };
      default:
        throw new Error(`${r.kind} not supported.`);
    }
  }

  function flattenOffer(o) {
    return harden({
      Asset: flattenRule(o.payoutRules[0]),
      Price: flattenRule(o.payoutRules[1]),
    });
  }

  function publicIDOrders(offerHandles) {
    const activeOfferHandles = zoe.getOfferStatuses(offerHandles).active;
    return zoe.getOffers(activeOfferHandles).map((offer, i) => {
      const publicID = inviteHandleToPublicID.get(activeOfferHandles[i]);
      const keywordOrders = flattenOffer(offer);

      const { give: AssetGive, want: AssetWant } = keywordOrders.Asset;
      const { give: PriceGive, want: PriceWant } = keywordOrders.Price;

      return harden({
        publicID,
        Asset: AssetGive || AssetWant,
        Price: PriceGive || PriceWant,
      });
    });
  }

  function getBookOrders() {
    return {
      changed: nextChangePromise.p,
      buys: publicIDOrders(inviteHandles.buy),
      sells: publicIDOrders(inviteHandles.sell),
    };
  }

  function getOrderStatus(inviteHandlesToMatch) {
    const requested = new Set(inviteHandlesToMatch);
    return {
      buys: publicIDOrders(inviteHandles.buy.filter(requested.has)),
      sells: publicIDOrders(inviteHandles.sell.filter(requested.has)),
    };
  }

  function getOffer(inviteHandle) {
    if (
      inviteHandles.sell.includes(inviteHandle) ||
      inviteHandles.buy.includes(inviteHandle)
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

  // Subscribe to changes in our inviteHandles.
  onHandlesExited(inviteHandles, bookOrdersChanged, {
    zoe,
    timerService,
  });

  function swapOrAddToBook(inviteHandlesToMatch, inviteHandle) {
    // Make note of the changes we did.
    bookOrdersChanged();
    for (const iHandle of inviteHandlesToMatch) {
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

  const makeInvite = invitePublicID => {
    let inviteHandle;

    assert(
      typeof invitePublicID === 'string',
      details`Invite publicID ${invitePublicID} must be a string`,
    );

    const seat = harden({
      // This code might be modified to support immediate_or_cancel. Current
      // implementation is effectively fill_or_kill.
      addOrder: () => {
        // Is it a valid sell offer?
        if (hasValidPayoutRules(['offerAtMost', 'wantAtLeast'], inviteHandle)) {
          // Save the valid offer and try to match

          // IDEA: to implement matching against the best price, the orders
          // should be sorted. (We'd also want to allow partial matches.)
          inviteHandles.sell.push(inviteHandle);
          inviteHandles.buy = [
            ...zoe.getOfferStatuses(inviteHandles.buy).active,
          ];
          return swapOrAddToBook(inviteHandles.buy, inviteHandle);
        }
        // Is it a valid buy offer?
        if (hasValidPayoutRules(['wantAtLeast', 'offerAtMost'], inviteHandle)) {
          // Save the valid offer and try to match
          inviteHandles.buy.push(inviteHandle);
          inviteHandles.sell = [
            ...zoe.getOfferStatuses(inviteHandles.sell).active,
          ];
          return swapOrAddToBook(inviteHandles.sell, inviteHandle);
        }
        // Eject because the offer must be invalid
        throw rejectOffer(inviteHandle);
      },
    });

    const { invite, inviteHandle: newInviteHandle } = zoe.makeInvite(seat, {
      seatDesc: 'addOrder',
    });
    inviteHandle = newInviteHandle;

    publicIDToInviteHandle.init(invitePublicID, inviteHandle);
    inviteHandleToPublicID.init(inviteHandle, invitePublicID);

    return { invite, inviteHandle };
  };

  return harden({
    invite: makeInvite('bootstrap'),
    publicAPI: { makeInvite, getBookOrders, getOrderStatus, getOffer },
    terms,
  });
});
