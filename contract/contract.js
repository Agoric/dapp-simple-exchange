/* eslint-disable no-use-before-define */
import harden from '@agoric/harden';
import { makePromise } from '@agoric/make-promise';
import {
  makeZoeHelpers,
  defaultAcceptanceMsg,
} from '@agoric/zoe/src/contractSupport/zoeHelpers';
import { zoeNotifier } from './zoeNotifier';

// This javascript source file uses the "tildot" syntax (foo~.bar()) for
// eventual sends.
// https://agoric.com/documentation/ertp/guide/other-concepts.html
//  Tildot is standards track with TC39, the JavaScript standards committee.
// https://github.com/tc39/proposal-wavy-dot

/**
 * The SimpleExchange uses Asset and Price as its keywords. In usage,
 * they're somewhat symmetrical. Participants will be buying or
 * selling in both directions.
 *
 * { give: { Asset: simoleans(5) }, want: { Price: quatloos(3) } }
 * { give: { Price: quatloos(8) }, want: { Asset: simoleans(3) } }
 *
 * The Asset is treated as an exact amount to be exchanged, while the
 * Price is a limit that may be improved on. This simple exchange does
 * not partially fill orders.
 */
export const makeContract = harden(zoe => {
  const PRICE = 'Price';
  const ASSET = 'Asset';

  let sellInviteHandles = [];
  let buyInviteHandles = [];
  let nextChangePromise = makePromise();

  const {
    rejectOffer,
    checkIfProposal,
    swap,
    canTradeWith,
    assertKeywords,
  } = makeZoeHelpers(zoe);

  // Instantiate a notifier.
  const { terms: { timerService } = {} } = zoe.getInstanceRecord();
  const { setHandleState, firstP: firstNotifyP } = zoeNotifier({
    zoe,
    timerService,
  });

  assertKeywords(harden([ASSET, PRICE]));

  function flattenOrders(offerHandles) {
    const activeHandles = zoe.getOfferStatuses(offerHandles).active;
    return zoe.getOffers(activeHandles).map((offerRecord, i) => ({
      inviteHandle: activeHandles[i],
      ...offerRecord,
    }));
  }

  function getBookOrders() {
    return {
      changed: nextChangePromise.p,
      buy: flattenOrders(buyInviteHandles),
      sell: flattenOrders(sellInviteHandles),
    };
  }

  function getOffer(inviteHandle) {
    for (const handle of [...sellInviteHandles, ...buyInviteHandles]) {
      if (inviteHandle === handle) {
        return flattenOrders([inviteHandle])[0];
      }
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

  function swapIfCanTrade(inviteHandles, inviteHandle) {
    for (const iHandle of inviteHandles) {
      if (canTradeWith(inviteHandle, iHandle)) {
        setHandleState(inviteHandle, 'matched');
        setHandleState(iHandle, 'fulfilled');
        bookOrdersChanged();
        return swap(inviteHandle, iHandle);
      }
    }
    bookOrdersChanged();
    return defaultAcceptanceMsg;
  }

  const makeInviteAndHandle = () => {
    const seat = harden({
      addOrder: () => {
        const buyAssetForPrice = harden({
          give: [PRICE],
          want: [ASSET],
        });
        const sellAssetForPrice = harden({
          give: [ASSET],
          want: [PRICE],
        });
        if (checkIfProposal(inviteHandle, sellAssetForPrice)) {
          // Save the valid offer and try to match
          setHandleState(inviteHandle, 'sell');
          sellInviteHandles.push(inviteHandle);
          buyInviteHandles = [...zoe.getOfferStatuses(buyInviteHandles).active];
          return swapIfCanTrade(buyInviteHandles, inviteHandle);
          /* eslint-disable no-else-return */
        } else if (checkIfProposal(inviteHandle, buyAssetForPrice)) {
          // Save the valid offer and try to match
          setHandleState(inviteHandle, 'buy');
          buyInviteHandles.push(inviteHandle);
          sellInviteHandles = [
            ...zoe.getOfferStatuses(sellInviteHandles).active,
          ];
          return swapIfCanTrade(sellInviteHandles, inviteHandle);
        } else {
          // Eject because the offer must be invalid
          return rejectOffer(inviteHandle);
        }
      },
    });
    const { invite, inviteHandle } = zoe.makeInvite(seat);
    return { invite, inviteHandle };
  };

  const makeInvite = () => makeInviteAndHandle().invite;

  const makeAdminInvite = () => {
    const seat = harden({
      getHandleNotifyP() {
        return firstNotifyP;
      },
    });
    const { invite } = zoe.makeInvite(seat);
    return invite;
  };

  return harden({
    invite: makeAdminInvite(),
    publicAPI: { makeInvite, getBookOrders, getOffer },
  });
});
