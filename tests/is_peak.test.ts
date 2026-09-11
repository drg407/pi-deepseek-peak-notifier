/**
 * isPeak boundary tests (spec.md "Validation Plan → Automated").
 *
 * Run:  node --experimental-strip-types tests/is_peak.test.ts
 * All instants are fixed UTC; expected values hand-computed from the pricing
 * rule (01:00–04:00 and 06:00–10:00 UTC, Mon–Fri; start-inclusive /
 * end-exclusive). Days verified: 2026-09-10 Thu, 09-11 Fri, 09-12 Sat,
 * 09-13 Sun.
 */
import { isPeak } from "../src/peak.ts";

type Case = [label: string, make: () => Date, expected: boolean];

const cases: Case[] = [
	["Thu 2026-09-10 00:59:59Z (just before 01:00)", () => new Date("2026-09-10T00:59:59Z"), false],
	["Thu 2026-09-10 01:00:00Z (window start, inclusive)", () => new Date("2026-09-10T01:00:00Z"), true],
	["Thu 2026-09-10 03:59:59Z (just before 04:00)", () => new Date("2026-09-10T03:59:59Z"), true],
	["Thu 2026-09-10 04:00:00Z (window end, exclusive)", () => new Date("2026-09-10T04:00:00Z"), false],
	["Thu 2026-09-10 05:00:00Z (mid-gap)", () => new Date("2026-09-10T05:00:00Z"), false],
	["Thu 2026-09-10 05:59:59Z (just before 06:00)", () => new Date("2026-09-10T05:59:59Z"), false],
	["Thu 2026-09-10 06:00:00Z (window start, inclusive)", () => new Date("2026-09-10T06:00:00Z"), true],
	["Thu 2026-09-10 09:59:59Z (just before 10:00)", () => new Date("2026-09-10T09:59:59Z"), true],
	["Thu 2026-09-10 10:00:00Z (window end, exclusive)", () => new Date("2026-09-10T10:00:00Z"), false],
	["Sat 2026-09-12 02:00:00Z (weekend, would-be peak hour)", () => new Date("2026-09-12T02:00:00Z"), false],
	["Sun 2026-09-13 07:00:00Z (weekend, would-be peak hour)", () => new Date("2026-09-13T07:00:00Z"), false],
	["Fri 2026-09-11 09:30:00Z (Friday peak)", () => new Date("2026-09-11T09:30:00Z"), true],
	["invalid Date (NaN time) -> off-peak, no throw", () => new Date("not a date"), false],
];

let failed = 0;
for (const [label, make, expected] of cases) {
	let actual: boolean;
	try {
		actual = isPeak(make());
	} catch (e) {
		console.log(`FAIL  ${label}: threw ${e}`);
		failed++;
		continue;
	}
	const ok = actual === expected;
	if (!ok) failed++;
	console.log(`${ok ? "PASS" : "FAIL"}  ${label}: isPeak=${actual} expected=${expected}`);
}
console.log(failed === 0 ? `\nALL ${cases.length} PASS` : `\n${failed}/${cases.length} FAILED`);
process.exit(failed === 0 ? 0 : 1);
