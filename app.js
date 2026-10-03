'use strict';

const Homey = require('homey');
const Waiter = require('./lib/Waiter');

/**
 * Advanced Waiting
 *
 * Homey's own delay mechanisms start at one whole second: the Advanced Flow Delay
 * block and the per-card delay in standard Flows. This app adds the missing case -
 * a card that simply pauses a Flow for a sub-second amount of time and then lets it
 * carry on, in place, without the Flow having to be restarted from a second trigger.
 *
 * The run listener returns a promise that only settles once the wait is over, which
 * is what makes the next card wait for it. That is also the app's hard limit: Homey
 * terminates a Flow that has been held open for roughly 89 seconds, so anything
 * longer is refused up front rather than left to fail silently.
 */
class AdvancedWaitingApp extends Homey.App {

  async onInit() {
    // The cancel function of every wait still running, so onUninit can let go of
    // all of them at once.
    this.pending = new Set();

    this.homey.flow.getConditionCard('wait')
      .registerRunListener(async (args) => {
        await this.run(args);
        return true;
      });

    this.log('Advanced Waiting started');
  }

  /**
   * Validate, then block for that long.
   *
   * Everything is inside the one try, so that a wait cancelled by the app shutting
   * down reaches the user in their own language too, rather than as the bare word
   * its error code is named after.
   */
  async run({ duration, unit }) {
    try {
      const ms = Waiter.toMilliseconds(duration, unit);

      if (this.pending.size >= Waiter.MAX_CONCURRENT) {
        throw new Waiter.WaitError('too_many', { max: Waiter.MAX_CONCURRENT });
      }

      const { promise, cancel } = Waiter.wait(ms, { timers: this.homey });
      this.pending.add(cancel);

      try {
        await promise;
      } finally {
        this.pending.delete(cancel);
      }
    } catch (err) {
      // Turn the library's error code into something the user reads in their own
      // language, in the Flow editor, on the card that caused it.
      if (err instanceof Waiter.WaitError) {
        throw new Error(this.homey.__(`error.${err.code}`, err.tokens));
      }
      throw err;
    }
  }

  /**
   * Cancel every wait still in flight. Without this the app would shut down with
   * promises nobody will ever settle, holding their Flows open until Homey times
   * them out.
   *
   * Each cancel rejects a promise whose `finally` removes it from the set, but that
   * runs a microtask later, so iterating here is safe.
   */
  async onUninit() {
    for (const cancel of this.pending) {
      cancel();
    }
    this.pending.clear();
  }

}

module.exports = AdvancedWaitingApp;
