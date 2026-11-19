import type { IRequest } from "itty-router";
import { z } from "zod";
import { createDb } from "../db/client";
import {
	bulkAddTimetableEntries,
	createBusStop,
	createTimetableEntry,
	deleteBusStop,
	deleteTimetableEntry,
	getAllBusStops,
	getBusStopById,
	getTimetableForBusStop,
} from "../repository/timeTable";
import type { Env } from "../types";
import type { DayType } from "../utils/time";
import { parseTimes } from "../utils/parseTimes";
import { getSessionCookie, verifySessionValue } from "../utils/session";

async function checkAuth(req: IRequest, env: Env): Promise<Response | null> {
	const session = getSessionCookie(req);
	if (!session || !(await verifySessionValue(session, env.ADMIN_API_TOKEN))) {
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
	const authError = await checkAuth(req, env);
	if (authError) return authError;

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	return Response.json(await getAllBusStops(db));
}

export async function handleCreateBusStop(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = await checkAuth(req, env);
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
	const authError = await checkAuth(req, env);
	if (authError) return authError;

	const id = parseInt(req.params["id"] ?? "", 10);
	if (isNaN(id)) {
		return Response.json({ error: "Invalid id" }, { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	await deleteBusStop(db, id);
	return new Response(null, { status: 204 });
}

export async function handleGetTimetable(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = await checkAuth(req, env);
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
	const authError = await checkAuth(req, env);
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
	const authError = await checkAuth(req, env);
	if (authError) return authError;

	const id = parseInt(req.params["id"] ?? "", 10);
	if (isNaN(id)) {
		return Response.json({ error: "Invalid id" }, { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	await deleteTimetableEntry(db, id);
	return new Response(null, { status: 204 });
}

const BulkTimetableSchema = z.object({
	busStopId: z.number().int().positive(),
	dayType: z.enum(["weekday", "saturday", "holiday"]),
	text: z.string().min(1).max(20000),
	replace: z.boolean().default(false),
});

const MAX_BULK_TIMES = 500;

/**
 * POST /admin/api/timetable/bulk
 * 貼り付けたテキストから時刻をまとめて登録する。解釈できない箇所が 1 つでもあれば何も登録しない。
 */
export async function handleBulkCreateTimetable(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const authError = await checkAuth(req, env);
	if (authError) return authError;

	const body = await req.json().catch(() => null);
	const parsed = BulkTimetableSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: parsed.error.flatten() }, { status: 400 });
	}
	const { busStopId, dayType, text, replace } = parsed.data;

	const { times, errors } = parseTimes(text);
	if (errors.length > 0) {
		return Response.json(
			{ error: "解釈できない時刻があります", details: errors },
			{ status: 400 },
		);
	}
	if (times.length === 0) {
		return Response.json({ error: "時刻が見つかりません" }, { status: 400 });
	}
	if (times.length > MAX_BULK_TIMES) {
		return Response.json(
			{ error: `一度に登録できるのは ${MAX_BULK_TIMES} 件までです` },
			{ status: 400 },
		);
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	if (!(await getBusStopById(db, busStopId))) {
		return Response.json({ error: "bus stop not found" }, { status: 404 });
	}

	const result = await bulkAddTimetableEntries(
		db,
		busStopId,
		dayType,
		times,
		replace,
	);
	return Response.json(result, { status: 201 });
}
