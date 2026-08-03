'use strict';

/**
 * Milliseconds per unit offered by the Flow cards.
 *
 * Deliberately only two. Homey kills a Flow that has been waiting for roughly 89
 * seconds, so a blocking card can never honour minutes and up: "1 minute" would be
 * the only valid value of that unit and "2 minutes" would already take the Flow
 * down. Offering them would produce nothing but errors. A minute is 60 seconds.
 */
const UNIT_MS = {
  milliseconds: 1,
  seconds: 1000,
};

/**
 * The ceiling this app refuses to cross, a few seconds below the ~89s at which
 * Homey terminates a waiting Flow. Measured on Homey Pro (Early 2023), firmware
 * 13.4.0; see README.md.
 */
const MAX_WAIT_MS = 85000;

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
 * immediately, which would turn "wait a very long time" into "do not wait at all".
 */
function toMilliseconds(duration, unit) {
  const factor = UNIT_MS[unit];
  if (factor === undefined) {
    throw new WaitError('unknown_unit', { unit: String(unit) });
  }

  const amount = Number(duration);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WaitError('invalid_duration', { duration: String(duration) });
  }

  const ms = amount * factor;
  if (ms > MAX_WAIT_MS) {
    throw new WaitError('too_long', { max: MAX_WAIT_MS / 1000 });
  }

  return ms;
}

/**
 * Resolve after `ms`, or reject if `signal` aborts first.
 *
 * Rejecting on abort is what lets the app let go of a Flow that is still waiting
 * when the app shuts down, instead of leaving a promise nothing will ever settle.
 *
 * `timers` is injected so the app can hand over homey.setTimeout - Homey clears
 * those itself when the app unloads - while the tests use the globals.
 */
function wait(ms, { signal, timers = globalThis } = {}) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(new WaitError('aborted'));
      return;
    }

    let handle = null;

    // Registered with { once: true }, so aborting takes the listener away itself
    // and only the finishing path has to clean up after the other.
    const onAbort = () => {
      timers.clearTimeout(handle);
      reject(new WaitError('aborted'));
    };

    handle = timers.setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

module.exports = {
  MAX_WAIT_MS,
  UNIT_MS,
  WaitError,
  toMilliseconds,
  wait,
};
