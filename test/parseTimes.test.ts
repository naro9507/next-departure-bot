import { describe, expect, test } from "bun:test";
import { parseTimes } from "../src/utils/parseTimes";

const fmt = (text: string) =>
	parseTimes(text).times.map((t) => `${t.hour}:${String(t.minute).padStart(2, "0")}`);

describe("parseTimes", () => {
	test("時刻の列挙 (カンマ・空白・改行)", () => {
		expect(fmt("6:30, 6:45 7:00\n7:15")).toEqual(["6:30", "6:45", "7:00", "7:15"]);
	});

	test("全角・日本語表記", () => {
		expect(fmt("６：３０、7時5分\n24時10分")).toEqual(["6:30", "7:05", "24:10"]);
	});

	test("時刻表の行形式", () => {
		expect(fmt("6: 05 25 45\n7 | 00 30\n8時 15")).toEqual([
			"6:05",
			"6:25",
			"6:45",
			"7:00",
			"7:30",
			"8:15",
		]);
	});

	test("重複を除いて早い順に並べる", () => {
		expect(fmt("7:00 6:30 7:00")).toEqual(["6:30", "7:00"]);
	});

	test("空行は無視する", () => {
		expect(parseTimes("\n  \n6:30\n").errors).toEqual([]);
	});

	test("範囲外や解釈できない箇所は errors に行番号付きで入る", () => {
		const r = parseTimes("6:30 abc\n31:00\n7: 05 75");
		expect(r.times).toEqual([
			{ hour: 6, minute: 30 },
			{ hour: 7, minute: 5 },
		]);
		expect(r.errors).toEqual(["1行目: abc", "2行目: 31:00", "3行目: 7:75"]);
	});

	test("6:30 (区切りの後に空白なし) は 1 つの時刻", () => {
		expect(fmt("6:30")).toEqual(["6:30"]);
	});
});
