'use strict';

const test = require('node:test');
const assert = require('node:assert');

const Waiter = require('../lib/Waiter');

test('converts both units to milliseconds', () => {
  assert.strictEqual(Waiter.toMilliseconds(500, 'milliseconds'), 500);
  assert.strictEqual(Waiter.toMilliseconds(2, 'seconds'), 2000);
});

test('accepts a duration that arrives as a string, as Flow tokens do', () => {
  assert.strictEqual(Waiter.toMilliseconds('750', 'milliseconds'), 750);
});

test('rejects a duration that is not a usable number', () => {
  for (const bad of ['', 'soon', null, undefined, NaN, Infinity]) {
    assert.throws(
      () => Waiter.toMilliseconds(bad, 'seconds'),
      (err) => err.code === 'invalid_duration',
      `expected ${String(bad)} to be refused`,
    );
  }
});

test('rejects zero and negative durations', () => {
  assert.throws(() => Waiter.toMilliseconds(0, 'seconds'), (err) => err.code === 'invalid_duration');
  assert.throws(() => Waiter.toMilliseconds(-1, 'seconds'), (err) => err.code === 'invalid_duration');
});

test('rejects units the cards do not offer', () => {
  for (const unit of ['minutes', 'hours', 'days', 'years', undefined]) {
    assert.throws(
      () => Waiter.toMilliseconds(1, unit),
      (err) => err.code === 'unknown_unit',
      `expected ${String(unit)} to be refused`,
    );
  }
});

test('rejects unit names inherited from Object.prototype', () => {
  // A plain object would answer UNIT_MS['toString'] with a function, which is not
  // undefined, so the unknown-unit guard would pass and the multiplication would
  // give NaN - a wait of no time at all, reported as success. Hence the Map.
  for (const unit of ['toString', '__proto__', 'constructor', 'valueOf', 'hasOwnProperty']) {
    assert.throws(
      () => Waiter.toMilliseconds(1, unit),
      (err) => err.code === 'unknown_unit',
      `expected ${unit} to be refused`,
    );
  }
});

test('never returns a duration that setTimeout would treat as zero', () => {
  for (const [duration, unit] of [[1, 'milliseconds'], ['0.5', 'milliseconds'], [85, 'seconds']]) {
    const ms = Waiter.toMilliseconds(duration, unit);
    assert.ok(Number.isFinite(ms) && ms > 0, `${duration} ${unit} gave ${ms}`);
  }
});

test('refuses waits past the ceiling, in either unit', () => {
  const overInSeconds = (Waiter.MAX_WAIT_MS / 1000) + 1;
  assert.throws(() => Waiter.toMilliseconds(overInSeconds, 'seconds'), (err) => err.code === 'too_long');
  assert.throws(() => Waiter.toMilliseconds(Waiter.MAX_WAIT_MS + 1, 'milliseconds'), (err) => err.code === 'too_long');
});

test('allows exactly the ceiling', () => {
  assert.strictEqual(Waiter.toMilliseconds(Waiter.MAX_WAIT_MS, 'milliseconds'), Waiter.MAX_WAIT_MS);
});

test('stays below the setTimeout overflow point, which fires immediately', () => {
  // A delay above 2^31-1 ms wraps and runs at once, turning a long wait into none.
  assert.ok(Waiter.MAX_WAIT_MS < 2 ** 31 - 1);
});

test('waits at least the requested time, never less', async () => {
  const started = Date.now();
  await Waiter.wait(120).promise;
  assert.ok(Date.now() - started >= 118, 'a wait that undershoots is a bug; overshooting is only latency');
});

test('cancelling rejects instead of resolving, so a Flow is not left hanging', async () => {
  const { promise, cancel } = Waiter.wait(60000);
  cancel();
  await assert.rejects(promise, (err) => err.code === 'aborted');
});

test('cancelling clears the timer, so nothing keeps the process alive', async () => {
  let cleared = null;
  const timers = {
    setTimeout: () => 'handle-1',
    clearTimeout: (handle) => {
      cleared = handle;
    },
  };

  const { promise, cancel } = Waiter.wait(60000, { timers });
  cancel();
  await assert.rejects(promise, (err) => err.code === 'aborted');
  assert.strictEqual(cleared, 'handle-1');
});

test('cancelling after the wait finished is harmless', async () => {
  const { promise, cancel } = Waiter.wait(10);
  await promise;
  cancel();
  // A settled promise ignores a later reject, so this must not throw or produce an
  // unhandled rejection.
  await promise;
});

test('the concurrency cap leaves room for realistic use', () => {
  assert.ok(Waiter.MAX_CONCURRENT >= 100);
});
