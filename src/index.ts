/**
 * DeepSeek peak-hours notifier (pi extension).
 *
 * Warns at session_start / model_select when the active model is DeepSeek,
 * and keeps a persistent footer indicator:
 *   peak window -> warning "⚠️ Peak Hours"    + footer "⚠️ deepseek: PEAK (2×)"
 *   off-peak    -> info    "✅ Off-Peak Hours" + footer "deepseek: off-peak"
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

function refresh(model: { provider: string; id: string } | undefined, ctx: ExtensionContext): void {
	if (!ctx.hasUI) return; // print/json modes: inert, no crash
	if (!model || model.provider !== PROVIDER) {
		ctx.ui.setStatus(STATUS_KEY, undefined); // no DeepSeek active: no visible status
		return;
	}
	if (isPeak(now())) {
		ctx.ui.notify(PEAK_NOTICE, "warning");
		ctx.ui.setStatus(STATUS_KEY, PEAK_STATUS);
	} else {
		ctx.ui.notify(OFFPEAK_NOTICE, "info");
		ctx.ui.setStatus(STATUS_KEY, OFFPEAK_STATUS);
	}
}

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => refresh(ctx.model, ctx));
	pi.on("model_select", (event, ctx) => refresh(event.model, ctx));
}
