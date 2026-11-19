import { describe, expect, test } from "bun:test";
import { kanjiToNumber, parseBusStopId } from "../src/utils/parseBusStopId";

describe("kanjiToNumber", () => {
	test.each([
		["一", 1],
		["九", 9],
		["十", 10],
		["十二", 12],
		["二十", 20],
		["二十五", 25],
		["百", 100],
		["百五", 105],
		["一〇", 10],
	])("%s → %i", (kanji, expected) => {
		expect(kanjiToNumber(kanji)).toBe(expected);
	});
});

describe("parseBusStopId", () => {
	test.each([
		["1", 1],
		["１", 1],
		["一", 1],
		["3", 3],
		["３", 3],
		["三", 3],
		["12", 12],
		["十二", 12],
		["1番", 1],
		["3番", 3],
		["5番のバス", 5],
		["バス停1", 1],
		["バス停 3", 3],
		["バス停　十", 10],
		[" 2 ", 2],
	])("%p → %i", (text, expected) => {
		expect(parseBusStopId(text)).toBe(expected);
	});

	test.each(["一覧", "こんにちは", "0", "次のバスは?", "", "-1"])("%p → null", (text) => {
		expect(parseBusStopId(text)).toBeNull();
	});
});
