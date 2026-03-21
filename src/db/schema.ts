import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const busStops = sqliteTable("bus_stops", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	createdAt: text("created_at")
		.notNull()
		.default(sql`(datetime('now'))`),
});

export const timetable = sqliteTable("timetable", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	busStopId: integer("bus_stop_id")
		.notNull()
		.references(() => busStops.id),
	dayType: text("day_type", {
		enum: ["weekday", "saturday", "holiday"],
	})
		.notNull()
		.$type<"weekday" | "saturday" | "holiday">(),
	hour: integer("hour").notNull(),
	minute: integer("minute").notNull(),
	createdAt: text("created_at")
		.notNull()
		.default(sql`(datetime('now'))`),
});
