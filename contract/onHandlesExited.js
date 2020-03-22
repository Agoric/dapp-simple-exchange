// TODO: There should be a Zoe mechanism to subscribe to changes on a handle.
// We really shouldn't have to poll.
import { E } from '@agoric/eventual-send';
import harden from '@agoric/harden';

const FIXME_POLL_DELAY_S = 10;
export function onHandlesExited(
  inviteHandleGroups,
  callback,
  { zoe, timerService },
) {
  const FIXMETimerHandler = harden({
    wake(_now) {
      // console.error('awake', _now);
      let exited = false;
      for (const [group, inviteHandles] of Object.entries(inviteHandleGroups)) {
        const newHandles = [...zoe.getOfferStatuses(inviteHandles).active];
        if (newHandles.length < inviteHandles.length) {
          // Update the invite handles.
          inviteHandleGroups[group] = newHandles;
          exited = true;
        }
      }

      if (exited) {
        callback();
      }
    },
  });

  // Poll every POLL_DELAY seconds.
  const repeater = E(timerService).createRepeater(0, FIXME_POLL_DELAY_S);
  E(repeater).schedule(FIXMETimerHandler);

  // Cancellation function.
  return () => E(repeater).disable();
}
