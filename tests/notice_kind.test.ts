/**
 * noticeKind hostile-input tests (2026-09-11 addendum: hosted DeepSeek models).
 *
 * Run:  node tests/notice_kind.test.ts
 * Covers the three classification branches plus the hostile inputs the house
 * rules demand: absent model, absent id, wrong types, empty strings, case
 * variants, provider-prefix lookalikes, and nested values containing the
 * match word.
 */
import { noticeKind } from "../src/index.ts";

type Kind = "direct" | "hosted" | "none";
type Case = [label: string, model: unknown, expected: Kind];

const cases: Case[] = [
	["no model at all (undefined)", undefined, "none"],
	["empty object (provider + id absent)", {}, "none"],
	["direct: provider match, empty id", { provider: "deepseek", id: "" }, "direct"],
	["direct: provider match, id absent", { provider: "deepseek" }, "direct"],
	["direct: provider match, wrong-type id (number)", { provider: "deepseek", id: 42 }, "direct"],
	["hosted: the real 2026-09-11 case (cloudflare-ai-gateway route to workers-ai)", { provider: "cloudflare-ai-gateway", id: "workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813" }, "hosted"],
	["hosted: direct workers-ai hosting (@cf model)", { provider: "cloudflare-workers-ai", id: "@cf/deepseek-ai/deepseek-v4-pro-0813" }, "hosted"],
	["hosted: id exactly the match word", { provider: "openrouter", id: "deepseek" }, "hosted"],
	["hosted: case-insensitive match", { provider: "workers-ai", id: "DeepSeek-V3" }, "hosted"],
	["hosted: provider prefix 'deepseek-clone' is NOT the direct provider", { provider: "deepseek-clone", id: "deepseek-v4-pro" }, "hosted"],
	["none: unrelated provider + unrelated id", { provider: "anthropic", id: "claude-sonnet-4-5" }, "none"],
	["none: unrelated provider, empty id", { provider: "anthropic", id: "" }, "none"],
	["none: unrelated provider, id absent", { provider: "anthropic" }, "none"],
	["none: unrelated provider, wrong-type id (number)", { provider: "anthropic", id: 123 }, "none"],
	["none: unrelated provider, nested object containing the match word", { provider: "anthropic", id: { nested: "deepseek" } }, "none"],
];

let failed = 0;
for (const [label, model, expected] of cases) {
	let actual: Kind;
	try {
		actual = noticeKind(model as any);
	} catch (e) {
		console.log(`FAIL  ${label}: threw ${e}`);
		failed++;
		continue;
	}
	const ok = actual === expected;
	if (!ok) failed++;
	console.log(`${ok ? "PASS" : "FAIL"}  ${label}: noticeKind=${actual} expected=${expected}`);
}
console.log(failed === 0 ? `\nALL ${cases.length} PASS` : `\n${failed}/${cases.length} FAILED`);
process.exit(failed === 0 ? 0 : 1);
