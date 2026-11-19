import { createClient } from "@libsql/client";
import { beforeEach, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import {
	createBusStop,
	createTimetableEntry,
	deleteBusStop,
	getBusStopById,
	getNextDeparture,
	getTimetableForBusStop,
} from "../src/repository/timeTable";
import { getJSTTime } from "../src/utils/time";

// Node 版 @libsql/client のインメモリ DB で実際の SQL を検証する (本番は /web 版)
async function setupDb(): Promise<Db> {
	const client = createClient({ url: ":memory:" });
	await client.executeMultiple(`
		CREATE TABLE bus_stops (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
		CREATE TABLE timetable (id INTEGER PRIMARY KEY AUTOINCREMENT, bus_stop_id INTEGER NOT NULL REFERENCES bus_stops(id), day_type TEXT NOT NULL, hour INTEGER NOT NULL, minute INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
	`);
	return drizzle(client, { schema }) as unknown as Db;
}

const jst = (iso: string) => getJSTTime(new Date(`${iso}+09:00`));

describe("timeTable repository", () => {
	let db: Db;
	let stopId: number;

	beforeEach(async () => {
		db = await setupDb();
		stopId = (await createBusStop(db, "駅前")).id;
		const entries = [
			{ dayType: "weekday", hour: 6, minute: 30 },
			{ dayType: "weekday", hour: 23, minute: 50 },
			{ dayType: "weekday", hour: 24, minute: 20 },
			{ dayType: "holiday", hour: 7, minute: 0 },
			{ dayType: "holiday", hour: 24, minute: 10 },
		] as const;
		for (const e of entries) await createTimetableEntry(db, { busStopId: stopId, ...e });
	});

	test("平日昼は今日のダイヤの次の便", async () => {
		expect(await getNextDeparture(db, stopId, jst("2026-11-19T12:00:00"))).toEqual({ hour: 23, minute: 50 });
	});

	test("平日 23:55 は今日のダイヤの 24:20 便", async () => {
		expect(await getNextDeparture(db, stopId, jst("2026-11-19T23:55:00"))).toEqual({ hour: 24, minute: 20 });
	});

	test("金曜 → 土曜 0:05 は前日 (平日) ダイヤの 24:20 便を 0:20 として返す", async () => {
		expect(await getNextDeparture(db, stopId, jst("2026-11-21T00:05:00"))).toEqual({ hour: 0, minute: 20 });
	});

	test("祝日 (11/23) の翌日 0:05 は前日 (holiday) ダイヤの 24:10 便", async () => {
		expect(await getNextDeparture(db, stopId, jst("2026-11-24T00:05:00"))).toEqual({ hour: 0, minute: 10 });
	});

	test("土曜はダイヤが無ければ null", async () => {
		expect(await getNextDeparture(db, stopId, jst("2026-11-21T12:00:00"))).toBeNull();
	});

	test("deleteBusStop は時刻表もまとめて削除", async () => {
		await deleteBusStop(db, stopId);
		expect(await getBusStopById(db, stopId)).toBeNull();
		expect(await getTimetableForBusStop(db, stopId)).toEqual([]);
	});
});
