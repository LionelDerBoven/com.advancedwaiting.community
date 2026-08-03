'use strict';

/**
 * Milliseconds per unit offered by the Flow cards.
 *
 * Deliberately only two. Homey kills a Flow that has been waiting for roughly 89
 * seconds, so a blocking card can never honour minutes and up: "1 minute" would be
 * the only valid value of that unit and "2 minutes" would already take the Flow
 * down. Offering them would produce nothing but errors. A minute is 60 seconds.
 *
 * A Map rather than an object literal, so a lookup can only ever find a unit that
 * was actually put here. A plain object inherits from Object.prototype, which means
 * UNIT_MS['toString'] returns a function instead of undefined - enough to slip past
 * an `=== undefined` guard and end up multiplying by a function, giving NaN.
 */
const UNIT_MS = new Map([
  ['milliseconds', 1],
  ['seconds', 1000],
]);

/**
 * The ceiling this app refuses to cross, a few seconds below the ~89s at which
 * Homey terminates a waiting Flow. Measured on Homey Pro (Early 2023), firmware
 * 13.4.0; see README.md.
 */
const MAX_WAIT_MS = 85000;

/**
 * How many waits may be in flight at once.
 *
 * Every wait holds a timer and a promise until it finishes, so a Flow retriggering
 * faster than its own wait can complete would pile them up unboundedly and take the
 * app's memory with it. Far above any sane use - a card running once per device
 * across a large house is dozens, not hundreds - so hitting this means a Flow is
 * looping, and an error naming that is more use than an out-of-memory restart.
 */
const MAX_CONCURRENT = 500;

/**
 * Thrown for anything the user can fix by editing the card. `code` maps to a key
 * in locales/*.json, so this file stays free of Homey imports and testable on its
 * own.
 */
class WaitError extends Error {

  constructor(code, tokens = {}) {
    super(code);
    this.name = 'WaitError';
    this.code = code;
    this.tokens = tokens;
  }

}

/**
 * Convert a card's duration + unit into milliseconds.
 *
 * Validation happens here rather than at the timer, because setTimeout silently
 * misbehaves at the extremes: a delay above 2^31-1 ms overflows and fires
 * immediately, and NaN is treated as zero. Either would turn a wait into no wait at
 * all, without an error to show for it.
 */
function toMilliseconds(duration, unit) {
  const factor = UNIT_MS.get(unit);
  if (factor === undefined) {
    throw new WaitError('unknown_unit', { unit: String(unit) });
  }

  const amount = Number(duration);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WaitError('invalid_duration', { duration: String(duration) });
  }

  const ms = amount * factor;
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new WaitError('invalid_duration', { duration: String(duration) });
  }
  if (ms > MAX_WAIT_MS) {
    throw new WaitError('too_long', { max: MAX_WAIT_MS / 1000 });
  }

  return ms;
}

/**
 * Start a wait. Returns the promise to await and a function that cancels it.
 *
 * Cancelling rejects, which is what lets the app let go of a Flow still waiting
 * when the app shuts down instead of leaving a promise nothing will ever settle.
 * Calling cancel after the wait has finished does nothing, since a settled promise
 * ignores a later reject.
 *
 * Deliberately not AbortController: that allocates a controller plus a signal - an
 * EventTarget - and adds and removes a listener on every single wait. A closure
 * does the same job here for one allocation.
 *
 * `timers` is injected so the app can hand over homey.setTimeout, which Homey
 * clears itself when the app unloads, while the tests use the globals.
 */
function wait(ms, { timers = globalThis } = {}) {
  let cancel;

  const promise = new Promise((resolve, reject) => {
    const handle = timers.setTimeout(resolve, ms);

    cancel = () => {
      timers.clearTimeout(handle);
      reject(new WaitError('aborted'));
    };
  });

  return { promise, cancel };
}

module.exports = {
  MAX_CONCURRENT,
  MAX_WAIT_MS,
  UNIT_MS,
  WaitError,
  toMilliseconds,
  wait,
};
