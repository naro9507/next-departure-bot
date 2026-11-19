const KANJI_DIGITS: Record<string, number> = {
	〇: 0,
	零: 0,
	一: 1,
	二: 2,
	三: 3,
	四: 4,
	五: 5,
	六: 6,
	七: 7,
	八: 8,
	九: 9,
};

/** 漢数字 (〜九百九十九) を数値に変換する。例: "十二" → 12, "百五" → 105, "一〇" → 10 */
export function kanjiToNumber(kanji: string): number | null {
	if (!/^[〇零一二三四五六七八九十百]+$/.test(kanji)) return null;

	// 位取りなし表記 ("一〇", "二五")
	if (!/[十百]/.test(kanji)) {
		return Number([...kanji].map((c) => KANJI_DIGITS[c]).join(""));
	}

	let total = 0;
	let digit: number | null = null;
	for (const c of kanji) {
		if (c === "百" || c === "十") {
			total += (digit ?? 1) * (c === "百" ? 100 : 10);
			digit = null;
		} else {
			digit = KANJI_DIGITS[c] ?? 0;
		}
	}
	return total + (digit ?? 0);
}

/**
 * LINE のメッセージからバス停 ID を取り出す。
 * 対応例: "3", "３", "三", "3番", "バス停3", "バス停 十二", "5番のバス"
 * 解釈できない場合は null。
 */
export function parseBusStopId(text: string): number | null {
	const normalized = text
		.normalize("NFKC") // 全角数字・全角スペースを半角に
		.trim()
		.replace(/[〇零一二三四五六七八九十百]+/g, (k) => String(kanjiToNumber(k) ?? k));

	const match = normalized.match(/^(\d+)$/)
		?? normalized.match(/バス停\s*(\d+)/)
		?? normalized.match(/^(\d+)\s*番/);
	if (!match) return null;

	const n = Number(match[1]);
	return Number.isSafeInteger(n) && n > 0 ? n : null;
}
