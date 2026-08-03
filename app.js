'use strict';

const Homey = require('homey');
const Waiter = require('./lib/Waiter');

/**
 * Advanced Waiting
 *
 * Homey's own delay mechanisms start at one whole second: the Advanced Flow Delay
 * block and the per-card delay in standard Flows. This app adds the missing case -
 * a card that simply pauses a Flow for a sub-second amount of time and then lets it
 * carry on, without a HomeyScript runtime or a second Flow to continue in.
 *
 * The run listener returns a promise that only settles once the wait is over, which
 * is what makes the next card wait for it. That is also the app's hard limit: Homey
 * terminates a Flow that has been held open for roughly 89 seconds, so anything
 * longer is refused up front rather than left to fail silently.
 */
class AdvancedWaitingApp extends Homey.App {

  async onInit() {
    // One controller per pending wait, so onUninit can let go of all of them.
    this.pending = new Set();

    this.homey.flow.getActionCard('wait')
      .registerRunListener((args) => this.run(args));

    this.homey.flow.getConditionCard('wait_then_continue')
      .registerRunListener(async (args) => {
        await this.run(args);
        return true;
      });

    this.log('Advanced Waiting started');
  }

  /**
   * Shared by both cards: validate, then block for that long.
   */
  async run({ duration, unit }) {
    let ms;
    try {
      ms = Waiter.toMilliseconds(duration, unit);
    } catch (err) {
      // Turn the library's error code into something the user reads in their own
      // language, in the Flow editor, on the card that caused it.
      if (err instanceof Waiter.WaitError) {
        throw new Error(this.homey.__(`error.${err.code}`, err.tokens));
      }
      throw err;
    }

    const controller = new AbortController();
    this.pending.add(controller);

    try {
      await Waiter.wait(ms, {
        signal: controller.signal,
        timers: this.homey,
      });
    } finally {
      this.pending.delete(controller);
    }
  }

  /**
   * Abort every wait still in flight. Without this the app would shut down with
   * promises nobody will ever settle, holding their Flows open until Homey times
   * them out.
   */
  async onUninit() {
    for (const controller of this.pending) {
      controller.abort();
    }
    this.pending.clear();
  }

}

module.exports = AdvancedWaitingApp;
