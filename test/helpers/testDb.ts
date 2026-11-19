import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "../../src/db/client";
import * as schema from "../../src/db/schema";

/** Node 版 @libsql/client のインメモリ DB (本番は /web 版 + Turso) */
export async function createTestDb(): Promise<Db> {
	const client = createClient({ url: ":memory:" });
	await client.executeMultiple(`
		CREATE TABLE bus_stops (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
		CREATE TABLE timetable (id INTEGER PRIMARY KEY AUTOINCREMENT, bus_stop_id INTEGER NOT NULL REFERENCES bus_stops(id), day_type TEXT NOT NULL, hour INTEGER NOT NULL, minute INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
		CREATE TABLE passkey_credentials (id TEXT PRIMARY KEY, public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
	`);
	return drizzle(client, { schema }) as unknown as Db;
}
