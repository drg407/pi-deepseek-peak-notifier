# Spec: DeepSeek Peak-Hours Notice (pi extension)

Project: `~/Developer/pi/pi-deepseek-peak-notifier/`

## Goal
The user never ends up paying DeepSeek peak (2×) rates without having been told — pi shows a
"⚠️ Peak Hours" notice and a persistent footer indicator whenever the active model is DeepSeek.

## Context
- pi (coding agent harness) extension. TS modules loaded via jiti. No npm deps (Node built-ins +
  pi types only).
- DeepSeek is configured in pi as provider id `deepseek` with models `deepseek-flash`
  (DeepSeek V4.1 Flash) and `deepseek-v4-pro`, base URL `https://api.deepseek.com`.
- Pricing rule (api-docs.deepseek.com, verified 2026-09-10): **peak = 01:00–04:00 and
  06:00–10:00 UTC, Monday–Friday**; all other hours off-peak at exactly half price. Windows are
  hour-aligned, start-inclusive / end-exclusive (01:00:00 ≤ t < 04:00:00, etc.).
- Windows are defined in UTC, so DST/timezone never affects the peak determination. (User TZ is
  America/New_York; locally peak ≈ 9 PM–midnight and 2–6 AM in EDT — informational only, the
  extension does no local-time display.)
- Relevant pi hooks (verified in docs/extensions.md): `session_start` (reasons startup/new/resume/
  fork/reload), `model_select` (source set/cycle/restore; carries `event.model`,
  `event.previousModel`), `ctx.model` (active model: `{ provider, id }`), `ctx.ui.notify(text,
  severity)`, `ctx.ui.setStatus(key, text)` (footer), `ctx.hasUI` / `ctx.mode` guards.
- Dev location: this project dir. Load for testing via `pi -e ./src/index.ts`; for permanent use
  register the local path in pi settings `extensions` array (mechanism per docs/extensions.md
  "Extension Locations") or symlink into `~/.pi/agent/extensions/` — decide at implementation,
  verify which works.

## Scope
### In scope
- Pure peak-window check function (UTC windows, fixed weekdays).
- One-shot notice at `session_start` when the active model's provider is `deepseek`.
- One-shot notice at `model_select` when the newly selected model's provider is `deepseek`.
- Persistent footer status while the active model is DeepSeek; cleared when it is not.
- Dev-only env override for "now" so peak behavior is testable at any wall-clock time.

### Out of scope (v1)
- State-change detection mid-session (user accepted: notices only at session start / model
  select; footer goes stale if a session crosses a boundary — documented limitation, no timer).
- Blocking/confirm prompt during peak (informational-only).
- Any local-time display, countdown, or "until HH:MM" detail in notices (user chose minimal
  wording).
- Any network call (the schedule is static, hard-coded from the pricing page; no fetch).
- Cost estimation, per-model price tables, currency display.
- Other providers.

## Requirements
1. `isPeak(date: Date): boolean` — pure function. True iff the UTC day-of-week is Monday–Friday
   AND (UTC hour ∈ {1,2,3} OR UTC hour ∈ {6,7,8,9}). No I/O, no hidden clock access.
2. Peak notice (one-shot, non-blocking, severity `warning`), exact text:
   ```
   ⚠️ Peak Hours
   ```
   Fired on `session_start` (any reason) and on `model_select`, whenever the active/new model's
   provider is `deepseek`.
3. Off-peak notice (one-shot, non-blocking, severity `info`), exact text:
   ```
   ✅ Off-Peak Hours
   ```
   Same trigger points.
4. Footer status via `ctx.ui.setStatus("deepseek-peak", …)`:
   - active model is DeepSeek and peak: `⚠️ deepseek: PEAK (2×)`
   - active model is DeepSeek and off-peak: `deepseek: off-peak`
   - active model is not DeepSeek: clear/remove the status text.
   Updated at the same trigger points as the notices (session_start, model_select).
5. Provider matching: `model.provider === "deepseek"` (matches both current models and any future
   models added under that provider).
6. Dev override: if env `DEEPSEEK_PEAK_FAKE_NOW` is set to an ISO-8601 timestamp, all
   "current time" evaluations in the extension use that instant instead of `new Date()`.
7. UI guards: every `ctx.ui.*` call is guarded by `ctx.hasUI` (no crash in print/json modes).
8. Extension must be inert (zero notices, zero status, zero error output) when no DeepSeek model
   is ever active in the session.

## Definition of Done
- [x] Test file for `isPeak` runs from the command line, all cases green. (2026-09-10: plain `node tests/is_peak.test.ts`, 13/13 — Node 22.22.2 strips types without a flag; `--experimental-strip-types` also works.)
- [x] At least one test case is shown to go RED against a deliberately broken variant of `isPeak`
      (boundary off-by-one), then green again on restore. (2026-09-10: window-end-inclusive mutation → exactly the 04:00:00Z and 10:00:00Z cases FAIL, rc=1; byte-identical restore, 13/13 green.)
- [ ] Manual: start pi with a DeepSeek model during off-peak → one `✅ Off-Peak Hours` notice +
      footer `deepseek: off-peak`.
- [ ] Manual: with `DEEPSEEK_PEAK_FAKE_NOW` set to peak instants (e.g. a Thursday 02:30Z and a
      Thursday 07:30Z) → `⚠️ Peak Hours` warning + footer `⚠️ deepseek: PEAK (2×)`.
- [ ] Manual: `Ctrl+P` (or `/model`) to a DeepSeek model → notice + footer appear; switching to a
      non-DeepSeek model → footer cleared, no new notice.
- [ ] Manual: session started on a non-DeepSeek model → no notices, no footer status, no console
      errors from the extension.

## Constraints
- Source lives in this project (`src/`); no npm dependencies.
- All pi APIs used must be verified against docs/examples before use (no guessing: `notify`
  severity values, `setStatus` clear semantics, `model_select` event shape — check
  docs/extensions.md + examples/extensions/).
- No timers, no fetch, no background resources from the extension factory (per pi docs: defer to
  events).
- Do not touch user's existing extensions (pi-token-footer, pi-injection-guard) or settings
  beyond the single registration entry needed to load this extension.

## Failure Modes / Edge Cases
- Exactly 04:00:00.000 UTC (window end) → off-peak (exclusive end).
- 04:00–06:00 UTC gap on a weekday → off-peak.
- Saturday/Sunday any hour → off-peak.
- Friday 09:59 UTC → peak; Friday 10:00 UTC → off-peak.
- DST transition days: no effect (UTC-based logic, no local-time display).
- Model switch deepseek-flash → deepseek-v4-pro → notice re-fires (acceptable, cheap).
- `session_start` reason `reload` → notice re-fires (acceptable).
- Non-TUI mode (print/json) → extension loads, does nothing visible, no crash.
- Clock skew / NTP jumps → out of scope; system clock is trusted.

## Validation Plan
Planned before implementation.
- **Automated:** command-line test file (run with Node TS type-stripping or the jiti bundled in
  the pi install — decide at implementation by whichever works out of the box) asserting
  `isPeak` at: 00:59:59Z / 01:00:00Z / 03:59:59Z / 04:00:00Z / 05:00Z / 05:59:59Z / 06:00:00Z /
  09:59:59Z / 10:00:00Z on a weekday; 02:00Z Saturday; 07:00Z Sunday; 09:30Z Friday.
- **RED proof:** mutate `isPeak` (e.g. make a window end inclusive), run, show the boundary
  cases fail, restore, re-run green.
- **Manual checks:** the Definition-of-Done manual items (off-peak start, fake-now peak start,
  model cycling on/off, non-DeepSeek session silence).
- **Regression guard:** pi sessions with other models unchanged; normal startup unaffected
  (extension inert by requirement 8); no new errors in pi's console at startup.

## Open Questions
None.

## Addendum — 2026-09-11: hosted DeepSeek models (user-approved)

Incident: `pi --model deepseek` is a pattern (pi help: "Model pattern or ID,
supports provider/id"); bare `deepseek` resolved to the built-in,
**unconfigured** gateway model
`cloudflare-ai-gateway` / `workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813`
(confirmed 2026-09-11 in the user's TUI: the hosted warning interpolated
exactly these values). No peak/off-peak notice fired — correct per Requirement 5 —
but the model was also unusable (no Workers AI auth) and the user got no
signal.

Change:
- New pure, exported `noticeKind(model)` → `direct` | `hosted` | `none`
  (`src/index.ts`), hostile-safe: absent model/id, wrong types, empty
  strings, nested values — `tests/notice_kind.test.ts` (14 cases, all
  green).
- `hosted` (DeepSeek-named id under any non-direct provider) now fires a
  one-shot `warning` notice — "DeepSeek model is hosted via
  '<provider>' ('<id>') — DeepSeek peak pricing does not apply" — and
  the footer is always cleared: a host-billed model never gets a DeepSeek
  peak claim. Behavior tests 11–13 added to `tests/behavior.test.ts`.
- RED proof (2026-09-11): mutating the hosted regex reds exactly the 4 hosted
  classification cases; deleting the hosted notify branch reds exactly the 2
  hosted behavior checks; byte-identical restore (cmp), suite green.
- `direct` behavior is byte-identical to v1 (the original 12 behavior checks
  pass unchanged).
- Supersedes, for DeepSeek-named models: "Out of scope → Other providers"
  and the README silence guarantee for "every other provider".
