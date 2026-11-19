// 日本の祝日判定 (内閣府「国民の祝日に関する法律」2022 年以降のルールに準拠)
// 春分・秋分は 1980〜2099 年で有効な近似式を使う。
// 月は 1〜12 で扱う。

const DAY_MS = 24 * 60 * 60 * 1000;

function nthMonday(year: number, month: number, n: number): number {
	const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
	const firstMonday = 1 + ((8 - firstDow) % 7);
	return firstMonday + (n - 1) * 7;
}

function vernalEquinoxDay(year: number): number {
	return Math.floor(
		20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
	);
}

function autumnalEquinoxDay(year: number): number {
	return Math.floor(
		23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
	);
}

/** 法律で日付が定められた祝日 (振替休日・国民の休日を除く) */
function isStatutoryHoliday(year: number, month: number, day: number): boolean {
	switch (month) {
		case 1:
			return day === 1 || day === nthMonday(year, 1, 2); // 元日, 成人の日
		case 2:
			return day === 11 || day === 23; // 建国記念の日, 天皇誕生日
		case 3:
			return day === vernalEquinoxDay(year); // 春分の日
		case 4:
			return day === 29; // 昭和の日
		case 5:
			return day === 3 || day === 4 || day === 5; // 憲法記念日, みどりの日, こどもの日
		case 7:
			return day === nthMonday(year, 7, 3); // 海の日
		case 8:
			return day === 11; // 山の日
		case 9:
			return day === nthMonday(year, 9, 3) || day === autumnalEquinoxDay(year); // 敬老の日, 秋分の日
		case 10:
			return day === nthMonday(year, 10, 2); // スポーツの日
		case 11:
			return day === 3 || day === 23; // 文化の日, 勤労感謝の日
		default:
			return false;
	}
}

function isStatutoryAt(ms: number): boolean {
	const d = new Date(ms);
	return isStatutoryHoliday(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** 祝日・振替休日・国民の休日なら true */
export function isJapaneseHoliday(year: number, month: number, day: number): boolean {
	if (isStatutoryHoliday(year, month, day)) return true;

	const ms = Date.UTC(year, month - 1, day);

	// 振替休日: 日曜の祝日以降、最初の祝日でない日
	for (let prev = ms - DAY_MS; isStatutoryAt(prev); prev -= DAY_MS) {
		if (new Date(prev).getUTCDay() === 0) return true;
	}

	// 国民の休日: 前日と翌日が祝日に挟まれた平日
	return isStatutoryAt(ms - DAY_MS) && isStatutoryAt(ms + DAY_MS);
}
