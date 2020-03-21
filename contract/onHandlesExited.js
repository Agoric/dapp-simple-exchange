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
  let cancelled = false;
  const FIXMETimerHandler = harden({
    wake(_now) {
      if (cancelled) {
        // Don't schedule again.
        return;
      }
      try {
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
      } finally {
        // Go again.
        E(timerService).setWakeup(FIXME_POLL_DELAY_S, FIXMETimerHandler);
      }
    },
  });

  // Start the first poll.
  E(timerService).setWakeup(FIXME_POLL_DELAY_S, FIXMETimerHandler);

  // Cancellation function.
  return () => (cancelled = true);
}
