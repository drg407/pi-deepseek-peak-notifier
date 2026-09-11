/**
 * Extension behavior tests (spec.md Requirements 2–8) with a stubbed ctx.
 *
 * Drives the real extension factory with a fake `pi`/`ctx` and asserts the
 * exact notify text/severity and footer status for each trigger point.
 *
 * Run:  node --experimental-strip-types tests/behavior.test.ts
 */
import { default as createExtension } from "../src/index.ts";

// --- fake pi / ctx ---------------------------------------------------------

const handlers: Record<string, (event: any, ctx: any) => void> = {};
createExtension({ on: (name: string, h: (event: any, ctx: any) => void) => (handlers[name] = h) } as any);

if (!handlers.session_start || !handlers.model_select) {
	console.log("FAIL  extension did not register both hooks");
	process.exit(1);
}

interface Call {
	text: string;
	severity?: string;
	key?: string;
}

function makeCtx(model: { provider: string; id: string } | undefined, hasUI = true) {
	const calls: Call[] = [];
	const ctx = {
		model,
		hasUI,
		ui: {
			notify: (text: string, severity: string) => calls.push({ text, severity }),
			setStatus: (key: string, text: string | undefined) => calls.push({ text, key }),
		},
	};
	return { ctx, calls };
}

const deepseek = { provider: "deepseek", id: "deepseek-flash" };
const other = { provider: "anthropic", id: "claude-sonnet-4-5" };

// --- test harness -----------------------------------------------------------

let failed = 0;
function check(label: string, cond: boolean, detail = "") {
	if (!cond) failed++;
	console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : `  [${detail}]`}`);
}

const savedEnv = process.env.DEEPSEEK_PEAK_FAKE_NOW;
const PEAK_NOW = "2026-09-10T02:30:00Z"; // Thursday, in 01:00–04:00 window
const OFFPEAK_NOW = "2026-09-10T12:00:00Z"; // Thursday, outside all windows

// 1. session_start, DeepSeek, peak
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = PEAK_NOW;
	const { ctx, calls } = makeCtx(deepseek);
	handlers.session_start({ reason: "startup" }, ctx);
	check(
		"session_start peak: warning '⚠️ Peak Hours'",
		calls.some((c) => c.text === "⚠️ Peak Hours" && c.severity === "warning"),
		JSON.stringify(calls),
	);
	check(
		"session_start peak: footer '⚠️ deepseek: PEAK (2×)' under key deepseek-peak",
		calls.some((c) => c.key === "deepseek-peak" && c.text === "⚠️ deepseek: PEAK (2×)"),
		JSON.stringify(calls),
	);
}

// 2. session_start, DeepSeek, off-peak
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = OFFPEAK_NOW;
	const { ctx, calls } = makeCtx(deepseek);
	handlers.session_start({ reason: "startup" }, ctx);
	check(
		"session_start off-peak: info '✅ Off-Peak Hours'",
		calls.some((c) => c.text === "✅ Off-Peak Hours" && c.severity === "info"),
		JSON.stringify(calls),
	);
	check(
		"session_start off-peak: footer 'deepseek: off-peak'",
		calls.some((c) => c.key === "deepseek-peak" && c.text === "deepseek: off-peak"),
		JSON.stringify(calls),
	);
}

// 3. model_select -> DeepSeek (from non-DeepSeek), peak
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = PEAK_NOW;
	const { ctx, calls } = makeCtx(other);
	handlers.model_select({ model: deepseek, previousModel: other, source: "cycle" }, ctx);
	check(
		"model_select -> deepseek (peak): warning notice + peak footer",
		calls.some((c) => c.text === "⚠️ Peak Hours" && c.severity === "warning") &&
			calls.some((c) => c.key === "deepseek-peak" && c.text === "⚠️ deepseek: PEAK (2×)"),
		JSON.stringify(calls),
	);
}

// 4. model_select -> non-DeepSeek (from DeepSeek): no notice, footer cleared
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = PEAK_NOW;
	const { ctx, calls } = makeCtx(deepseek);
	handlers.model_select({ model: other, previousModel: deepseek, source: "set" }, ctx);
	check(
		"model_select away: no notify, footer cleared (undefined)",
		calls.every((c) => c.severity === undefined) &&
			calls.length === 1 &&
			calls[0].key === "deepseek-peak" &&
			calls[0].text === undefined,
		JSON.stringify(calls),
	);
}

// 5. model_select -> non-DeepSeek (from non-DeepSeek): only an invisible clear
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = PEAK_NOW;
	const { ctx, calls } = makeCtx(other);
	handlers.model_select({ model: other, previousModel: other, source: "cycle" }, ctx);
	check(
		"model_select non-DS -> non-DS: no notify, no visible status",
		calls.every((c) => c.severity === undefined) && calls.every((c) => c.text === undefined),
		JSON.stringify(calls),
	);
}

// 6. session_start, non-DeepSeek: inert (no notify, no visible status)
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = PEAK_NOW;
	const { ctx, calls } = makeCtx(other);
	handlers.session_start({ reason: "startup" }, ctx);
	check(
		"session_start non-DS: no notify, no visible status",
		calls.every((c) => c.severity === undefined) && calls.every((c) => c.text === undefined),
		JSON.stringify(calls),
	);
}

// 7. hasUI=false (print/json mode): no crash, zero calls
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = PEAK_NOW;
	const { ctx, calls } = makeCtx(deepseek, /* hasUI */ false);
	handlers.session_start({ reason: "startup" }, ctx);
	handlers.model_select({ model: deepseek, previousModel: other, source: "cycle" }, ctx);
	check("hasUI=false: zero ui calls, no crash", calls.length === 0, JSON.stringify(calls));
}

// 8. ctx.model undefined at session_start (docs: "may be undefined"): no crash
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = PEAK_NOW;
	const { ctx, calls } = makeCtx(undefined);
	handlers.session_start({ reason: "startup" }, ctx);
	check(
		"session_start model=undefined: no crash, no visible status",
		calls.every((c) => c.text === undefined),
		JSON.stringify(calls),
	);
}

// 9. real clock (no override): behavior must match an independently written
//    peak rule (h<=3 / h<=9 form), computed at the same instant
{
	delete process.env.DEEPSEEK_PEAK_FAKE_NOW;
	const real = new Date();
	const { ctx, calls } = makeCtx(deepseek);
	handlers.session_start({ reason: "startup" }, ctx);
	const h = real.getUTCHours();
	const wd = real.getUTCDay();
	const expectedPeak = wd >= 1 && wd <= 5 && ((h >= 1 && h <= 3) || (h >= 6 && h <= 9));
	const gotPeak = calls.some((c) => c.text === "⚠️ Peak Hours");
	check(`real clock ${real.toISOString()}: peak=${expectedPeak} matches extension`, gotPeak === expectedPeak);
}

// 10. malformed DEEPSEEK_PEAK_FAKE_NOW: falls back to real clock, no crash
{
	process.env.DEEPSEEK_PEAK_FAKE_NOW = "not-an-iso-timestamp";
	const { ctx, calls } = makeCtx(deepseek);
	handlers.session_start({ reason: "startup" }, ctx);
	check(
		"malformed FAKE_NOW: no crash, still fires exactly one notice",
		calls.filter((c) => c.severity !== undefined).length === 1,
		JSON.stringify(calls),
	);
}

process.env.DEEPSEEK_PEAK_FAKE_NOW = savedEnv;
console.log(failed === 0 ? "\nALL BEHAVIOR CHECKS PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
