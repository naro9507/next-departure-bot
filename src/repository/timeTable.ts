import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { busStops, timetable } from "../db/schema";
import type { DayType } from "../utils/time";

export interface NextDeparture {
	hour: number;
	minute: number;
	busStopName: string;
}

export async function getNextDeparture(
	db: Db,
	busStopId: number,
	dayType: DayType,
	currentHour: number,
	currentMinute: number,
): Promise<NextDeparture | null> {
	const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;

	const result = await db
		.select({
			hour: timetable.hour,
			minute: timetable.minute,
			busStopName: busStops.name,
		})
		.from(timetable)
		.innerJoin(busStops, eq(timetable.busStopId, busStops.id))
		.where(
			and(
				eq(timetable.busStopId, busStopId),
				eq(timetable.dayType, dayType),
				sql`${timetable.hour} * 60 + ${timetable.minute} > ${currentMinutesSinceMidnight}`,
			),
		)
		.orderBy(asc(timetable.hour), asc(timetable.minute))
		.limit(1);

	return result[0] ?? null;
}

export async function getAllBusStops(db: Db) {
	return db.select().from(busStops);
}

export async function createBusStop(db: Db, name: string) {
	const result = await db.insert(busStops).values({ name }).returning();
	return result[0];
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
