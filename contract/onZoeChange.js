// TODO: There should be a Zoe mechanism to subscribe to any changes.
// We really shouldn't have to poll.
import { E } from '@agoric/eventual-send';
import harden from '@agoric/harden';

const FIXME_POLL_DELAY_S = 4;
export function onZoeChange(
  callback,
  { zoe, timerService },
) {
  const FIXMETimerHandler = harden({
    wake: callback,
  });

  // Poll every POLL_DELAY seconds.
  const repeater = E(timerService).createRepeater(0, FIXME_POLL_DELAY_S);
  E(repeater).schedule(FIXMETimerHandler);

  // Cancellation function.
  return () => E(repeater).disable();
}
