import { E } from '@agoric/eventual-send';
import harden from '@agoric/harden';
import makePromise from '@agoric/make-promise';
import makeStore from '@agoric/store';

const POLL_DELAY_S = 4;
const NEW_STATE = 'new';
const INACTIVE_STATE = 'inactive';

/**
 * A Zoe notifier allows the caller to call
 * setHandleState(inviteHandle, state) to add the handle
 * to our list if it isn't already.
 *
 * When the handle state is changed automatically by our
 * 'inactive' detector, or directly by setHandleState,
 * we resolve the notify promise with
 * ({ [newState]: [oldOfferState...], nextP: newPromise })
 *
 * When the state is set to 'inactive', the handle is
 * removed from our list.
 */
export function zoeNotifier({ zoe, timerService }) {
  let notify = makePromise();
  let activeHandles = [];
  const inviteHandleToOfferState = makeStore();

  // Deliver a result and a new promise for the next result.
  const doNotify = result => {
    const newNotify = makePromise();
    notify.res({ ...result, nextP: newNotify.p });
    notify = newNotify;
  };

  // Detect when handles become inactive.
  const timerHandler = harden({
    wake(_now) {
      const { active, inactive: inactiveHandles } = zoe.getOfferStatuses(
        activeHandles,
      );

      // Make a writable copy.
      activeHandles = [...active];
      if (!inactiveHandles.length) {
        return;
      }
      const inactiveOfferStates = [];
      inactiveHandles.forEach(inviteHandle => {
        const offerState = inviteHandleToOfferState.get(inviteHandle);
        if (offerState) {
          inactiveOfferStates.push(offerState);
          inviteHandleToOfferState.delete(inviteHandle);
        }
      });
      doNotify({ [INACTIVE_STATE]: inactiveOfferStates });
    },
  });

  // Ensure the handle is being tracked, and set its state.
  const setHandleState = (inviteHandle, state) => {
    let lastOfferState;
    if (!inviteHandleToOfferState.has(inviteHandle)) {
      activeHandles.push(inviteHandle);
      const offer = zoe.getOffer(inviteHandle);
      lastOfferState = { ...offer, inviteHandle, state: NEW_STATE };
      inviteHandleToOfferState.init(inviteHandle, {
        ...lastOfferState,
        state,
      });
    } else {
      lastOfferState = inviteHandleToOfferState.get(inviteHandle);
      inviteHandleToOfferState.set(inviteHandle, {
        ...lastOfferState,
        state,
      });
    }
    doNotify({ [state]: [lastOfferState] });
  };

  // Poll every POLL_DELAY seconds.
  const repeater = E(timerService).createRepeater(0, POLL_DELAY_S);
  E(repeater).schedule(timerHandler);

  const cancel = () => {
    notify.rej('cancelled');
    notify = makePromise();
    E(repeater).cancel();
  };

  return { cancel, setHandleState, firstP: notify.p };
}
