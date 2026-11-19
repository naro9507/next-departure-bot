import { describe, expect, test } from "bun:test";
import { pickNextDeparture } from "../src/repository/timeTable";
import { formatTime, formatTimeForSpeech, getJSTTime } from "../src/utils/time";

// JST の日時から UTC の Date を作る
const jst = (iso: string) => new Date(`${iso}+09:00`);

describe("getJSTTime", () => {
	test("UTC を JST に換算する", () => {
		const t = getJSTTime(new Date("2026-11-19T15:30:00Z")); // JST 11/20 0:30
		expect(t.hour).toBe(0);
		expect(t.minute).toBe(30);
	});

	test("曜日区分: 平日 / 土曜 / 日曜", () => {
		expect(getJSTTime(jst("2026-11-20T10:00:00")).dayType).toBe("weekday");
		expect(getJSTTime(jst("2026-11-21T10:00:00")).dayType).toBe("saturday");
		expect(getJSTTime(jst("2026-11-22T10:00:00")).dayType).toBe("holiday");
	});

	test("祝日は holiday (勤労感謝の日 2026-11-23 月曜)", () => {
		expect(getJSTTime(jst("2026-11-23T10:00:00")).dayType).toBe("holiday");
	});

	test("土曜の祝日は holiday を優先", () => {
		// 2025-05-03 は土曜の憲法記念日
		expect(getJSTTime(jst("2025-05-03T10:00:00")).dayType).toBe("holiday");
	});

	test("previousDayType は前日の区分", () => {
		const t = getJSTTime(jst("2026-11-24T00:10:00")); // 火曜、前日は勤労感謝の日
		expect(t.dayType).toBe("weekday");
		expect(t.previousDayType).toBe("holiday");
	});
});

describe("formatTime", () => {
	test("通常の時刻", () => {
		expect(formatTime(7, 5)).toBe("07:05");
	});
	test("24 時以降は (翌日)", () => {
		expect(formatTime(24, 38)).toBe("00:38(翌日)");
	});
});

describe("formatTimeForSpeech", () => {
	test("ちょうどの時刻は分を読まない", () => {
		expect(formatTimeForSpeech(7, 0)).toBe("7時");
	});
	test("分あり", () => {
		expect(formatTimeForSpeech(14, 35)).toBe("14時35分");
	});
	test("24 時以降は深夜", () => {
		expect(formatTimeForSpeech(24, 38)).toBe("深夜0時38分");
	});
});

describe("pickNextDeparture", () => {
	test("どちらも無ければ null", () => {
		expect(pickNextDeparture(null, null)).toBeNull();
	});
	test("今日のダイヤのみ", () => {
		expect(pickNextDeparture({ hour: 6, minute: 0 }, null)).toEqual({ hour: 6, minute: 0 });
	});
	test("前日ダイヤの深夜便は今日の暦日基準に直す", () => {
		expect(pickNextDeparture(null, { hour: 24, minute: 30 })).toEqual({ hour: 0, minute: 30 });
	});
	test("早い方を選ぶ", () => {
		expect(pickNextDeparture({ hour: 6, minute: 0 }, { hour: 24, minute: 30 })).toEqual({
			hour: 0,
			minute: 30,
		});
		expect(pickNextDeparture({ hour: 0, minute: 20 }, { hour: 24, minute: 30 })).toEqual({
			hour: 0,
			minute: 20,
		});
	});
});
