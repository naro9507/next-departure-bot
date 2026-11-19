import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { busStops, timetable } from "../db/schema";
import type { DayType, JSTTime } from "../utils/time";

export interface Departure {
	/** 現在の暦日基準の時。今日のダイヤの深夜便は 24 以上になる */
	hour: number;
	minute: number;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * 今日のダイヤの候補と、前日ダイヤの深夜便 (hour >= 24) の候補から早い方を選ぶ。
 * 前日ダイヤの便は今日の暦日基準 (hour - 24) に直して返す。
 */
export function pickNextDeparture(
	today: Departure | null,
	fromPreviousDay: Departure | null,
): Departure | null {
	const prev = fromPreviousDay
		? { hour: fromPreviousDay.hour - 24, minute: fromPreviousDay.minute }
		: null;
	if (!today) return prev;
	if (!prev) return today;
	const toMin = (d: Departure) => d.hour * 60 + d.minute;
	return toMin(prev) <= toMin(today) ? prev : today;
}

async function findFirstAfter(
	db: Db,
	busStopId: number,
	dayType: DayType,
	afterMinutes: number,
): Promise<Departure | null> {
	const rows = await db
		.select({ hour: timetable.hour, minute: timetable.minute })
		.from(timetable)
		.where(
			and(
				eq(timetable.busStopId, busStopId),
				eq(timetable.dayType, dayType),
				sql`${timetable.hour} * 60 + ${timetable.minute} > ${afterMinutes}`,
			),
		)
		.orderBy(asc(timetable.hour), asc(timetable.minute))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * 次の発車時刻を返す。
 * 日付をまたいだ直後 (例: 0:10) は、前日ダイヤの 24:xx 便も候補に含める。
 */
export async function getNextDeparture(
	db: Db,
	busStopId: number,
	now: JSTTime,
): Promise<Departure | null> {
	const nowMinutes = now.hour * 60 + now.minute;

	const [today, fromPreviousDay] = await Promise.all([
		findFirstAfter(db, busStopId, now.dayType, nowMinutes),
		findFirstAfter(
			db,
			busStopId,
			now.previousDayType,
			nowMinutes + MINUTES_PER_DAY,
		),
	]);

	return pickNextDeparture(today, fromPreviousDay);
}

export async function getBusStopById(db: Db, id: number) {
	const rows = await db
		.select()
		.from(busStops)
		.where(eq(busStops.id, id))
		.limit(1);
	return rows[0] ?? null;
}

export async function getAllBusStops(db: Db) {
	return db.select().from(busStops).orderBy(asc(busStops.id));
}

export async function createBusStop(db: Db, name: string) {
	const result = await db.insert(busStops).values({ name }).returning();
	return result[0];
}

/** バス停と紐づく時刻表をまとめて削除する (SQLite は FK カスケードが既定で無効のため) */
export async function deleteBusStop(db: Db, id: number) {
	await db.batch([
		db.delete(timetable).where(eq(timetable.busStopId, id)),
		db.delete(busStops).where(eq(busStops.id, id)),
	]);
}

export async function getTimetableForBusStop(
	db: Db,
	busStopId: number,
	dayType?: DayType,
) {
	const conditions = [eq(timetable.busStopId, busStopId)];
	if (dayType) conditions.push(eq(timetable.dayType, dayType));

	return db
		.select()
		.from(timetable)
		.where(and(...conditions))
		.orderBy(asc(timetable.dayType), asc(timetable.hour), asc(timetable.minute));
}

export async function createTimetableEntry(
	db: Db,
	entry: {
		busStopId: number;
		dayType: DayType;
		hour: number;
		minute: number;
	},
) {
	const result = await db.insert(timetable).values(entry).returning();
	return result[0];
}

export async function deleteTimetableEntry(db: Db, id: number) {
	await db.delete(timetable).where(eq(timetable.id, id));
}

/**
 * 時刻をまとめて登録する。
 * - replace = true: そのバス停・曜日区分の既存時刻を削除してから登録 (1 トランザクション)
 * - replace = false: 既に登録済みの時刻はスキップして追加
 */
export async function bulkAddTimetableEntries(
	db: Db,
	busStopId: number,
	dayType: DayType,
	times: { hour: number; minute: number }[],
	replace: boolean,
): Promise<{ added: number; skipped: number; deleted: number }> {
	const sameStopAndDay = and(
		eq(timetable.busStopId, busStopId),
		eq(timetable.dayType, dayType),
	);

	const existing = await db
		.select({ hour: timetable.hour, minute: timetable.minute })
		.from(timetable)
		.where(sameStopAndDay);

	const existingKeys = new Set(existing.map((e) => e.hour * 60 + e.minute));
	const toInsert = (replace
		? times
		: times.filter((t) => !existingKeys.has(t.hour * 60 + t.minute)))
		.map((t) => ({ busStopId, dayType, hour: t.hour, minute: t.minute }));

	const insert = toInsert.length > 0 ? db.insert(timetable).values(toInsert) : null;

	if (replace) {
		const del = db.delete(timetable).where(sameStopAndDay);
		await (insert ? db.batch([del, insert]) : del);
	} else if (insert) {
		await insert;
	}

	return {
		added: toInsert.length,
		skipped: times.length - toInsert.length,
		deleted: replace ? existing.length : 0,
	};
}
