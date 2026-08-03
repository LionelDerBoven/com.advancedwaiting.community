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
  await Waiter.wait(120);
  assert.ok(Date.now() - started >= 118, 'a wait that undershoots is a bug; overshooting is only latency');
});

test('aborting rejects instead of resolving, so a Flow is not left hanging', async () => {
  const controller = new AbortController();
  const pending = Waiter.wait(60000, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (err) => err.code === 'aborted');
});

test('a signal already aborted rejects immediately', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    Waiter.wait(60000, { signal: controller.signal }),
    (err) => err.code === 'aborted',
  );
});

test('a completed wait leaves no abort listener behind', async () => {
  const controller = new AbortController();
  await Waiter.wait(10, { signal: controller.signal });
  // Aborting after the fact must not throw or resurrect anything.
  controller.abort();
});
