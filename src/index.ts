/**
 * DeepSeek peak-hours notifier (pi extension).
 *
 * Warns at session_start / model_select when the active model is DeepSeek,
 * and keeps a persistent footer indicator:
 *   peak window -> warning "⚠️ Peak Hours"    + footer "⚠️ deepseek: PEAK (2×)"
 *   off-peak    -> warning "✅ Off-Peak Hours" + footer "deepseek: off-peak"
 * (Off-peak uses the warning channel on purpose: pi's info severity renders as a
 * dim, unprefixed line that is invisible on some themes — verified in the
 * user's TUI 2026-09-11. The emoji disambiguates the two notice kinds.)
 * A DeepSeek-NAMED model under another provider (e.g. cloudflare-workers-ai
 * "@cf/deepseek-ai/...") is host-billed, so it gets a one-shot warning
 * instead of any peak claim: "DeepSeek model is hosted via '<provider>'
 * ('<id>') — DeepSeek peak pricing does not apply", and the footer clears.
 * Informational only. Peak = 01:00–04:00 and 06:00–10:00 UTC, Mon–Fri (2× rate).
 *
 * Dev load:        pi -e ./src/index.ts
 * Freeze "now":    DEEPSEEK_PEAK_FAKE_NOW=<ISO-8601>
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isPeak } from "./peak.ts";

const PROVIDER = "deepseek";
const STATUS_KEY = "deepseek-peak";
const PEAK_NOTICE = "⚠️ Peak Hours";
const OFFPEAK_NOTICE = "✅ Off-Peak Hours";
const PEAK_STATUS = "⚠️ deepseek: PEAK (2×)";
const OFFPEAK_STATUS = "deepseek: off-peak";

function now(): Date {
	const fake = process.env.DEEPSEEK_PEAK_FAKE_NOW;
	if (fake) {
		const d = new Date(fake);
		if (!Number.isNaN(d.getTime())) return d;
		// Malformed dev override: fall through to the real clock, never crash the session.
	}
	return new Date();
}

/**
 * Classify a model for notice purposes. Pure and hostile-safe (tested in
 * tests/notice_kind.test.ts: absent model/id, wrong types, empty strings).
 *   "direct"  — provider is exactly "deepseek": DeepSeek's own peak pricing applies.
 *   "hosted"  — a deepseek-named id under any other provider (host-billed;
 *               peak pricing does NOT apply — warn, never claim).
 *   "none"    — not DeepSeek in any sense: fully silent.
 */
export function noticeKind(model: { provider: string; id: string } | undefined): "direct" | "hosted" | "none" {
	if (!model) return "none";
	if (model.provider === PROVIDER) return "direct";
	if (typeof model.id === "string" && /deepseek/i.test(model.id)) return "hosted";
	return "none";
}

function refresh(model: { provider: string; id: string } | undefined, ctx: ExtensionContext): void {
	if (!ctx.hasUI) return; // print/json modes: inert, no crash
	const kind = noticeKind(model);
	if (kind === "direct") {
		if (isPeak(now())) {
			ctx.ui.notify(PEAK_NOTICE, "warning");
			ctx.ui.setStatus(STATUS_KEY, PEAK_STATUS);
		} else {
			ctx.ui.notify(OFFPEAK_NOTICE, "warning"); // see header: info renders dim/invisible
			ctx.ui.setStatus(STATUS_KEY, OFFPEAK_STATUS);
		}
		return;
	}
	ctx.ui.setStatus(STATUS_KEY, undefined); // hosted / unrelated: never claim DeepSeek's pricing
	if (kind === "hosted" && model) {
		ctx.ui.notify(`DeepSeek model is hosted via '${model.provider}' ('${model.id}') — DeepSeek peak pricing does not apply`, "warning");
	}
}

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => refresh(ctx.model, ctx));
	pi.on("model_select", (event, ctx) => refresh(event.model, ctx));
}
