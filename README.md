# pi-deepseek-peak-notifier

A heads-up for the [pi coding agent](https://pi.dev) when your active model is DeepSeek
during its 2× peak-pricing windows.

```
Warning: ⚠️ Peak Hours        ← one-shot notice, at session start or when you switch to DeepSeek
…  ⚠️ deepseek: PEAK (2×)     ← persistent footer status while the active model is DeepSeek
```

Off-peak you instead get a notice `✅ Off-Peak Hours` and footer status
`deepseek: off-peak`. Switch to any non-DeepSeek model and the footer clears —
no notice, no status.

Both notices ride pi's `warning` channel. (pi's `info` severity renders as a
dim, unprefixed chat line that is effectively invisible on some themes —
verified in the author's TUI 2026-09-11 — so the extension opts into the one
high-contrast one-shot channel pi offers; the emoji is the distinguisher.)

## The peak rule

Per the [DeepSeek API pricing docs](https://api-docs.deepseek.com/quick_start/pricing/) (verified 2026-09-10):

- Peak (2× rate): **Monday–Friday, 01:00–04:00 UTC and 06:00–10:00 UTC**;
  all other hours are off-peak at half price.
- Windows are hour-aligned, start-inclusive / end-exclusive
  (`01:00:00 ≤ t < 04:00:00`, etc.) — exactly 04:00:00 UTC is already off-peak.
- Windows are defined in UTC, so DST and local timezone never affect the
  determination. (For reference, in America/New_York EDT the peak windows land
  roughly 9 PM–midnight and 2–6 AM local.)

## Install

```bash
pi install git:github.com/drg407/pi-deepseek-peak-notifier
```

Remove with `pi remove git:github.com/drg407/pi-deepseek-peak-notifier`.
Or, for a quick try without installing:

```bash
pi -e git:github.com/drg407/pi-deepseek-peak-notifier
```

## Usage

- Automatic — no configuration, no commands, no external services, no auth access.
- The notice and footer update at `session_start` and `model_select`
  (i.e. `Ctrl+P` / `/model`).
- Direct DeepSeek models (provider `deepseek`) get the peak/off-peak notice
  and footer. A DeepSeek-named model under any other provider gets a one-shot
  hosted warning and a cleared footer (see "Hosted DeepSeek models" below).
  Every other model is fully silent.
- TUI only: in print / JSON / RPC modes the extension is inert.

## Hosted DeepSeek models

pi's built-in model registry includes DeepSeek models hosted by other
providers — both `cloudflare-workers-ai` (`@cf/deepseek-ai/...`) and
`cloudflare-ai-gateway` (routes like `workers-ai/@cf/deepseek-ai/...`). Those
are billed at the host's rates — DeepSeek's peak pricing does not apply —
and the provider may have no auth configured at all.

Watch out: `pi --model deepseek` is a **pattern**, not a `provider/id`. Bare
`deepseek` resolved (verified 2026-09-11, twice) to the unconfigured gateway
model `workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813` — a model you cannot
even talk to. For that case this extension fires a one-shot warning instead
of any peak claim, and the footer stays clear:

```
Warning: DeepSeek model is hosted via 'cloudflare-ai-gateway' ('workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813') — DeepSeek peak pricing does not apply
```

To use the direct DeepSeek API, launch with the explicit form —
`pi --model deepseek/deepseek-v4-pro` — or switch via the `Ctrl+P` picker,
which lists only your configured providers.

## What this extension does (and doesn't)

- Hooks `session_start` and `model_select`; classification is the pure,
  exported `noticeKind(model)`: provider `deepseek` → peak/off-peak; any
  other provider with a DeepSeek-named id → hosted warning; everything
  else → silent.
- Peak determination is a pure function of the UTC clock (`src/peak.ts`) —
  no network calls, no state kept, nothing sent anywhere.
- Invalid dates are treated as off-peak and never throw.
- It warns; it does not block, throttle, or change which model is used.

## Development

```bash
npm test   # isPeak unit tests + noticeKind hostile-input tests + extension behavior tests (plain node, Node 22+ strips the TS types)
```

Freeze the clock to exercise either branch at any wall-clock time (dev-only):

```bash
DEEPSEEK_PEAK_FAKE_NOW="2026-09-10T02:30:00Z" pi -e ./src/index.ts
```

A malformed `DEEPSEEK_PEAK_FAKE_NOW` falls through to the real clock — it
never crashes the session.

## License

MIT — see [LICENSE](./LICENSE).
