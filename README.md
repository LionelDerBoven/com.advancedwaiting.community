# Advanced Waiting

A Homey app with one job: **pause a Flow for a number of milliseconds, then let it carry on.**

Homey's own delay mechanisms start at one whole second — the Advanced Flow **Delay** block and the
per-card delay in standard Flows. Timer apps like FlowBits can do milliseconds, but asynchronously:
the timer card returns immediately and the rest of your Flow has to hang off a separate "timer
finished" trigger, splitting one linear Flow into two branches. This app adds the missing thing — a
card that blocks in place.

Unofficial community app. Not affiliated with Athom.

## Cards

| Kind | Card | Where to use it |
|---|---|---|
| Action (THEN) | **Wait** *500 milliseconds* | Advanced Flows. The next card runs once this one finishes. |
| Condition (AND) | **Wait, then continue** *500 milliseconds* | The **And** column of a standard Flow — the only place there where a pause can be inserted, because a standard Flow's Then cards are not run in order. Always answers yes. |

Units are **milliseconds** and **seconds**. Nothing longer — see below.

## The limit: 85 seconds, and why

Homey terminates a Flow that has been waiting for roughly **89 seconds** ("flow timed out"). An app's
card can only hold a Flow open by leaving its run listener's promise unresolved, so that ceiling is
the hard limit for anything this app can do. Minutes would have exactly one valid value (1) and every
larger one would take the Flow down with it, so the unit is not offered at all.

This was measured, not assumed. On a Homey Pro (Early 2023), firmware 13.4.0:

| Wait | Result |
|---|---|
| 85 s (this app) | Completed in 85116 ms |
| 60 s (another app's blocking wait card) | Completed in 60019 ms |
| 120 s (same card, same Flow shape) | **Never continued.** No error, no timeline entry, nothing |

The failure is silent, which is what makes it dangerous: the cards after the wait simply never run.
So this app **refuses anything over 85 seconds** with an error naming the limit, rather than
accepting the value and letting the Flow disappear. That refusal is deliberate — an app that offered
Minutes and Hours would look more capable while quietly breaking Flows.

**For longer pauses, use Homey's built-in Delay block.** It is not subject to this limit at all,
because it is a flow-engine node rather than a card: the engine schedules the continuation instead of
holding a card open. That is also why it reaches hours while this app cannot.

## Accuracy

Measured on a Homey Pro (Early 2023), firmware 13.4.0, running 44 apps at load ~1.0. Each figure is
the gap between two notification cards in an identically shaped Advanced Flow, so the measurement
overhead is the same across all rows.

| Approach | 500 ms wait measured | Spread |
|---|---|---|
| Homey's built-in Delay, `"number": "0.5"` ¹ | 520, 522, 521 ms | 2 ms |
| **This app** | **535, 526, 522 ms** | **13 ms** |
| HomeyScript `await wait(500)` | 533, 526, 560 ms | 34 ms |
| FlowBits timer + trigger (two cards) | 577 ms | — |

Expect roughly 20–35 ms of overhead on top of the time you ask for. That overhead is one IPC hop
between the flow engine and this app's process, which is why the engine's own Delay block is a touch
tighter and why nothing running inside an app can close that last gap.

Measured at the card itself rather than between two notification cards, a 500 ms wait takes
**506 ms** — so most of the 26 ms above is the measuring apparatus, not the wait.

A wait never finishes *early* — `setTimeout` guarantees "at least this long" — so all drift is
positive, and it grows when the Homey is busy. If you need a precise landing point, measure once and
subtract: ask for 475 ms to land on 500.

## Design notes

Three things are deliberate rather than incidental:

- **`UNIT_MS` is a `Map`, not an object literal.** A plain object inherits from `Object.prototype`,
  so `UNIT_MS['toString']` returns a function rather than `undefined` — enough to pass an
  `=== undefined` guard, multiply to `NaN`, slip past the ceiling check, and reach `setTimeout(NaN)`,
  which fires immediately. That is a wait of no time at all reported as success. A `Map` can only
  answer with what was put in it. Covered by a regression test.
- **No `AbortController`.** Cancellation is a closure returned alongside the promise. The standard
  approach allocates a controller plus a signal — an `EventTarget` — and adds and removes a listener
  on every single wait, to do a job one closure does here.
- **A concurrency cap** (`MAX_CONCURRENT`). Every wait holds a timer and a promise until it finishes,
  so a Flow retriggering faster than its own wait can complete would pile them up without limit. The
  cap is far above realistic use, so reaching it means a Flow is looping — and an error saying so is
  more use than an out-of-memory restart.

¹ See the next section.

## Hopefully this app becomes unnecessary

**Homey can already do millisecond waits with its own Delay block.** The engine multiplies the stored
value and hands it to a timer, and nothing in that path rounds or floors. The only obstacle is the
input field in the Homey app, which refuses to accept a decimal point.

The value is stored as a *string*:

```json
{ "type": "delay", "args": { "delay": { "number": "0.5", "multiplier": 1 } } }
```

`multiplier` is `1` for seconds, `60` for minutes, `3600` for hours. Write a fraction into `number`
through the Web API and Homey honours it exactly. Measured on firmware 13.4.0:

| Value written | Actual wait |
|---|---|
| `"0.5"` | 520, 522, 521 ms — spread of 2 ms |
| `"0.1"` | ~100 ms |
| `"0.05"` | ~50 ms |

This is the most accurate sub-second wait available on Homey — better than this app can be, because
there is no hop out to an app process. It also has no 85 second ceiling, since it is engine-scheduled.

Three things are worth knowing before relying on it:

- **The editor displays it correctly.** A Delay block holding `0.5` shows "0.5 sec" in the Flow
  editor, and opening the Flow does not destroy the value. Only *typing* a decimal is blocked.
- **You cannot author it in the app.** Delete the `.` and the field lets you edit again; you cannot
  put it back. So these delays can only be created programmatically — via the Web API, a HomeyScript
  using `Homey.flow`, or a tool that speaks the API on your behalf.
- **It is undocumented.** Athom never advertised fractional delays, and the restriction looks like an
  input mask that assumes whole units rather than a deliberate policy. If validation is ever added to
  that field, existing fractional delays could silently become 0 or 1 second — the worst kind of
  regression, because nothing would announce it.

That last point is this app's whole reason to exist. It does the same job through a supported API, in
a card you can type into yourself, that a firmware update will not quietly invalidate.

**If Athom ever allows a decimal in the Delay block's input field, this app is obsolete and you should
uninstall it.** That would be the better outcome: one less app, better accuracy, no ceiling, and
nothing undocumented to depend on. Until then, the choice is between a card anyone can edit and a
value only an API can write.

## Development

```bash
npm install
npm test          # node --test, no Homey required
npm run lint
homey app validate --level publish
homey app run     # live on your Homey
homey app install # install permanently
```

`lib/Waiter.js` holds the unit conversion and the promise-around-`setTimeout`, with no Homey imports,
which is why it can be unit-tested on its own. It throws error *codes*; `app.js` turns those into
translated messages so the user reads them in their own language on the card that caused them.

## Licence

GPL-3.0-or-later.
