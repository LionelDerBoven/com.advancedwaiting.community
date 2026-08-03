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

## Why no minutes, hours or days

Homey terminates a Flow that has been waiting for roughly **89 seconds** ("flow timed out"). An app's
card can only hold a Flow open by leaving its run listener's promise unresolved, so that ceiling is
the hard limit for anything this app can do. Minutes would have exactly one valid value (1) and every
larger one would take the Flow down with it, so the unit is not offered at all.

The app refuses anything over **85 seconds** with an explanation, rather than letting Homey kill the
Flow in a way that is hard to debug.

**For longer pauses, use Homey's built-in Delay block.** It is not subject to this limit at all,
because it is a flow-engine node rather than a card: the engine schedules the continuation instead of
holding a card open. That is also why it reaches hours while this app cannot.

## Accuracy

Measured on a Homey Pro (Early 2023), firmware 13.4.0, running 44 apps at load ~1.0. Each figure is
the gap between two notification cards in an identically shaped Advanced Flow, so the measurement
overhead is the same across all rows.

| Approach | 500 ms wait measured | Jitter |
|---|---|---|
| Homey's built-in Delay, `"number": "0.5"` ¹ | 520, 522, 521 ms | 2 ms |
| **This app** | see below | |
| HomeyScript `await wait(500)` | 533, 526, 560 ms | 34 ms |
| FlowBits timer + trigger (two cards) | 577 ms | — |

Expect roughly 10–30 ms of overhead on top of the time you ask for. A wait never finishes *early* —
`setTimeout` guarantees "at least this long" — so all drift is positive, and it grows when the Homey
is busy. If you need a precise offset, measure once and subtract: ask for 480 ms to land on 500.

¹ Undocumented: Homey's built-in Delay stores its value as a string and honours fractions such as
`0.5`, `0.1` and `0.05` when written through the API. It is the most accurate option available, but
the Homey app's input field refuses to accept a decimal point, so those values can only be written
programmatically. This app exists to make sub-second waits something you can type into a card
yourself, using a supported API that a firmware update will not quietly invalidate.

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
