import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { passkeyCredentials } from "../db/schema";

export async function listPasskeys(db: Db) {
	return db.select().from(passkeyCredentials);
}

export async function getPasskeyById(db: Db, id: string) {
	const rows = await db
		.select()
		.from(passkeyCredentials)
		.where(eq(passkeyCredentials.id, id))
		.limit(1);
	return rows[0] ?? null;
}

export async function savePasskey(
	db: Db,
	id: string,
	publicKey: string,
	counter: number,
) {
	await db.insert(passkeyCredentials).values({ id, publicKey, counter });
}

export async function updatePasskeyCounter(
	db: Db,
	id: string,
	counter: number,
) {
	await db
		.update(passkeyCredentials)
		.set({ counter })
		.where(eq(passkeyCredentials.id, id));
}

export async function hasPasskey(db: Db): Promise<boolean> {
	const rows = await db
		.select({ id: passkeyCredentials.id })
		.from(passkeyCredentials)
		.limit(1);
	return rows.length > 0;
}
