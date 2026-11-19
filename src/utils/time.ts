import { isJapaneseHoliday } from "./holiday";

export type DayType = "weekday" | "saturday" | "holiday";

export interface JSTTime {
	hour: number;
	minute: number;
	/** 今日の曜日区分 */
	dayType: DayType;
	/** 前日の曜日区分 (前日ダイヤの 24 時以降の便を探すのに使う) */
	previousDayType: DayType;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** JST に換算した Date (getUTC* で JST の値が取れる) から曜日区分を判定する */
function dayTypeOf(jstDate: Date): DayType {
	const year = jstDate.getUTCFullYear();
	const month = jstDate.getUTCMonth() + 1;
	const day = jstDate.getUTCDate();
	const dow = jstDate.getUTCDay(); // 0=Sun, 6=Sat

	if (dow === 0 || isJapaneseHoliday(year, month, day)) return "holiday";
	if (dow === 6) return "saturday";
	return "weekday";
}

/** `now` はテスト用。通常は省略して現在時刻を使う */
export function getJSTTime(now: Date = new Date()): JSTTime {
	const jstDate = new Date(now.getTime() + JST_OFFSET_MS);
	const yesterday = new Date(jstDate.getTime() - DAY_MS);

	return {
		hour: jstDate.getUTCHours(),
		minute: jstDate.getUTCMinutes(),
		dayType: dayTypeOf(jstDate),
		previousDayType: dayTypeOf(yesterday),
	};
}

// 24:38 → "00:38(翌日)" のような表示
export function formatTime(hour: number, minute: number): string {
	const h = hour % 24;
	const suffix = hour >= 24 ? "(翌日)" : "";
	return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}${suffix}`;
}

// 音声読み上げ用: 7:00 → "7時", 24:38 → "深夜0時38分"
export function formatTimeForSpeech(hour: number, minute: number): string {
	const prefix = hour >= 24 ? "深夜" : "";
	const m = minute === 0 ? "" : `${minute}分`;
	return `${prefix}${hour % 24}時${m}`;
}
