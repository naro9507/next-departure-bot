import { eq } from "drizzle-orm";
import type { IRequest } from "itty-router";
import { z } from "zod";
import { createDb } from "../db/client";
import { busStops, timetable } from "../db/schema";
import {
	createBusStop,
	createTimetableEntry,
	deleteTimetableEntry,
	getAllBusStops,
	getTimetableForBusStop,
} from "../repository/timeTable";
import type { Env } from "../types";
import type { DayType } from "../utils/time";

function checkAuth(req: IRequest, env: Env): Response | null {
	const auth = req.headers.get("Authorization");
	if (!auth || auth !== `Bearer ${env.ADMIN_API_TOKEN}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}
	return null;
}

const CreateBusStopSchema = z.object({
	name: z.string().min(1).max(100),
});

const CreateTimetableSchema = z.object({
	busStopId: z.number().int().positive(),
	dayType: z.enum(["weekday", "saturday", "holiday"]),
	hour: z.number().int().min(0).max(30),
	minute: z.number().int().min(0).max(59),
});

export async function handleGetBusStops(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = checkAuth(req, env);
	if (authError) return authError;

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	return Response.json(await getAllBusStops(db));
}

export async function handleCreateBusStop(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = checkAuth(req, env);
	if (authError) return authError;

	const body = await req.json().catch(() => null);
	const parsed = CreateBusStopSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	return Response.json(await createBusStop(db, parsed.data.name), {
		status: 201,
	});
}

export async function handleDeleteBusStop(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = checkAuth(req, env);
	if (authError) return authError;

	const id = parseInt(req.params["id"] ?? "", 10);
	if (isNaN(id)) {
		return Response.json({ error: "Invalid id" }, { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	// Delete associated timetable entries first
	await db.delete(timetable).where(eq(timetable.busStopId, id));
	await db.delete(busStops).where(eq(busStops.id, id));
	return new Response(null, { status: 204 });
}

export async function handleGetTimetable(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = checkAuth(req, env);
	if (authError) return authError;

	const busStopId = parseInt(req.params["busStopId"] ?? "", 10);
	if (isNaN(busStopId)) {
		return Response.json({ error: "Invalid busStopId" }, { status: 400 });
	}

	const dayTypeStr = req.query["dayType"];
	const dayType = Array.isArray(dayTypeStr) ? dayTypeStr[0] : dayTypeStr;
	const validDayType =
		dayType === "weekday" || dayType === "saturday" || dayType === "holiday"
			? (dayType as DayType)
			: undefined;

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	return Response.json(
		await getTimetableForBusStop(db, busStopId, validDayType),
	);
}

export async function handleCreateTimetable(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = checkAuth(req, env);
	if (authError) return authError;

	const body = await req.json().catch(() => null);
	const parsed = CreateTimetableSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	return Response.json(await createTimetableEntry(db, parsed.data), {
		status: 201,
	});
}

export async function handleDeleteTimetable(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = checkAuth(req, env);
	if (authError) return authError;

	const id = parseInt(req.params["id"] ?? "", 10);
	if (isNaN(id)) {
		return Response.json({ error: "Invalid id" }, { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	await deleteTimetableEntry(db, id);
	return new Response(null, { status: 204 });
}
