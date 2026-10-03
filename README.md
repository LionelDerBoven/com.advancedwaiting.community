# Advanced Waiting

A Homey app with one job: **pause a Flow for milliseconds or seconds, then let it carry on in place.**

Homey's own delays start at one whole second (the Advanced Flow **Delay** block and the per-card
delay in standard Flows). This app adds a card for anything shorter.

Unofficial community app, not affiliated with Athom.

## Usage

One condition card, **Wait** *500 milliseconds*, that always answers yes:

| Flow type | Where to put it |
|---|---|
| Standard Flow | The **And** column — the only place a pause fits, since Then cards are not run in order. |
| Advanced Flow | Anywhere. Connect only the **yes** output. |

Units: **milliseconds** and **seconds**, up to **85 seconds**.

## Why the 85 second limit

A card holds a Flow open by not resolving its run listener, and Homey terminates a Flow that has been
waiting for roughly 89 seconds. Measured on Homey Pro (Early 2023), firmware 13.4.0:

| Wait | Result |
|---|---|
| 85 s | Completed in 85116 ms |
| 120 s | Never continued — no error, no timeline entry |

Because that failure is silent, the card refuses anything above 85 seconds with a clear error instead.
For longer pauses, use Homey's built-in **Delay** block: it is scheduled by the flow engine and has no
such limit.

## Accuracy

A 500 ms wait measures about **506 ms** at the card, or 520–535 ms between two notification cards in
an Advanced Flow. Waits never finish early (`setTimeout` guarantees "at least"); drift is always
positive and grows when Homey is busy. For a precise landing point, measure once and subtract.

## Native alternative

Homey's Delay block already honours fractions such as `"0.5"` when that value is written through the
Web API — it is only the input field in the Homey app that refuses a decimal point. This is undocumented
and cannot be authored in the app, so it may break silently in a future firmware. This app does the
same job through a supported API. If Athom ever allows decimals in that field, this app is no longer
needed.

## Development

```bash
npm install
npm test                          # unit tests, no Homey needed
npm run lint
homey app validate --level publish
homey app run                     # run live on your Homey
```

- `lib/Waiter.js` — unit conversion, validation and the cancellable wait. No Homey imports, so it is
  unit-tested on its own; it throws error codes.
- `app.js` — registers the card, caps concurrent waits, cancels pending waits on unload and turns
  error codes into translated messages (`locales/`).
- `README.txt` / `README.nl.txt` / `README.fr.txt` — the App Store text.

## Credits

Built by LDB Technology, with [Claude](https://claude.com/claude-code) (Anthropic) as co-author.

## License

[GPL-3.0-or-later](LICENSE)
