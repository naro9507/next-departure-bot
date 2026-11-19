export interface ParsedTime {
	hour: number;
	minute: number;
}

export interface ParseTimesResult {
	/** 重複を除き、早い順に並べた時刻 */
	times: ParsedTime[];
	/** 解釈できなかった箇所 (例: "3行目: 25:75") */
	errors: string[];
}

const MAX_HOUR = 30;

function toTime(hour: number, minute: number): ParsedTime | null {
	if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
	if (hour < 0 || hour > MAX_HOUR || minute < 0 || minute > 59) return null;
	return { hour, minute };
}

/**
 * 管理画面の一括登録用に、貼り付けたテキストから発車時刻を読み取る。
 *
 * 対応する書き方 (1 行に混在しなければ、行ごとに違う形式でもよい):
 * - 時刻を並べる:   "6:30, 6:45 7:00" / "6時30分" / "２４：１０"
 * - 時刻表の行形式: "6: 05 25 45" / "6 | 05 25 45" / "6時 05 25 45"
 *   (時の後ろに区切り + 空白を置き、分を 1 つ以上並べる)
 */
export function parseTimes(text: string): ParseTimesResult {
	const found = new Map<number, ParsedTime>();
	const errors: string[] = [];

	const add = (t: ParsedTime) => found.set(t.hour * 60 + t.minute, t);

	const lines = text.normalize("NFKC").split(/\r?\n/);

	lines.forEach((raw, i) => {
		const line = raw
			.replace(/時/g, ":")
			.replace(/分/g, " ")
			.replace(/[|｜]/g, ": ")
			.replace(/[、,，]/g, " ")
			.trim();
		if (!line) return;

		const lineNo = `${i + 1}行目`;

		// 行形式: "6: 05 25 45"
		const row = line.match(/^(\d{1,2})\s*:\s+(\d{1,2}(?:\s+\d{1,2})*)$/);
		if (row) {
			const hour = Number(row[1]);
			for (const m of row[2].split(/\s+/)) {
				const t = toTime(hour, Number(m));
				if (t) add(t);
				else errors.push(`${lineNo}: ${row[1]}:${m}`);
			}
			return;
		}

		// 時刻の列挙: "6:30 6:45"
		for (const token of line.split(/\s+/)) {
			const m = token.match(/^(\d{1,2}):(\d{1,2})$/);
			const t = m ? toTime(Number(m[1]), Number(m[2])) : null;
			if (t) add(t);
			else errors.push(`${lineNo}: ${token}`);
		}
	});

	const times = [...found.values()].sort(
		(a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
	);
	return { times, errors };
}
