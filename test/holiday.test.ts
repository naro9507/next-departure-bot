import { describe, expect, test } from "bun:test";
import { isJapaneseHoliday } from "../src/utils/holiday";

describe("isJapaneseHoliday", () => {
	// 2026 年の祝日 (内閣府公表)
	const holidays2026: [number, number][] = [
		[1, 1], // 元日
		[1, 12], // 成人の日
		[2, 11], // 建国記念の日
		[2, 23], // 天皇誕生日
		[3, 20], // 春分の日
		[4, 29], // 昭和の日
		[5, 3], // 憲法記念日 (日曜)
		[5, 4], // みどりの日
		[5, 5], // こどもの日
		[5, 6], // 振替休日
		[7, 20], // 海の日
		[8, 11], // 山の日
		[9, 21], // 敬老の日
		[9, 22], // 国民の休日
		[9, 23], // 秋分の日
		[10, 12], // スポーツの日
		[11, 3], // 文化の日
		[11, 23], // 勤労感謝の日
	];

	test.each(holidays2026)("2026-%i-%i は祝日", (month, day) => {
		expect(isJapaneseHoliday(2026, month, day)).toBe(true);
	});

	test("2026 年の祝日数は 18 日", () => {
		let count = 0;
		for (let m = 1; m <= 12; m++) {
			const days = new Date(Date.UTC(2026, m, 0)).getUTCDate();
			for (let d = 1; d <= days; d++) {
				if (isJapaneseHoliday(2026, m, d)) count++;
			}
		}
		expect(count).toBe(holidays2026.length);
	});

	test("2025 年の振替休日・春分・秋分", () => {
		expect(isJapaneseHoliday(2025, 2, 24)).toBe(true); // 天皇誕生日の振替
		expect(isJapaneseHoliday(2025, 3, 20)).toBe(true); // 春分の日
		expect(isJapaneseHoliday(2025, 9, 23)).toBe(true); // 秋分の日
		expect(isJapaneseHoliday(2025, 11, 24)).toBe(true); // 勤労感謝の日の振替
	});

	test("平日は祝日でない", () => {
		expect(isJapaneseHoliday(2026, 11, 19)).toBe(false);
		expect(isJapaneseHoliday(2026, 5, 7)).toBe(false);
		expect(isJapaneseHoliday(2026, 9, 24)).toBe(false);
	});
});
