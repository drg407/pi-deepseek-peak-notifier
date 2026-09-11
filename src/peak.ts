/**
 * DeepSeek peak-window check.
 *
 * Pricing rule (api-docs.deepseek.com, verified 2026-09-10): peak =
 * 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday (2× rate). Windows are
 * hour-aligned, start-inclusive / end-exclusive.
 */
export function isPeak(date: Date): boolean {
	if (Number.isNaN(date.getTime())) return false; // invalid date -> off-peak, never throws
	const day = date.getUTCDay(); // 0 = Sunday .. 6 = Saturday
	if (day < 1 || day > 5) return false; // Saturday / Sunday
	const hour = date.getUTCHours(); // 0..23
	return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}
