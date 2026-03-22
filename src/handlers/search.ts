import type { IRequest } from "itty-router";
import { createDb } from "../db/client";
import { getNextDeparture } from "../repository/timeTable";
import type { Env } from "../types";
import { formatTime, getJSTTime } from "../utils/time";

export async function handleSearch(req: IRequest, env: Env): Promise<Response> {
	const busStopIdStr = req.query["busStopId"];
	if (!busStopIdStr) {
		return Response.json({ error: "busStopId is required" }, { status: 400 });
	}

	const busStopId = parseInt(
		Array.isArray(busStopIdStr) ? busStopIdStr[0] : busStopIdStr,
		10,
	);
	if (isNaN(busStopId)) {
		return Response.json(
			{ error: "busStopId must be a number" },
			{ status: 400 },
		);
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	const { hour, minute, dayType } = getJSTTime();
	const next = await getNextDeparture(db, busStopId, dayType, hour, minute);

	if (!next) {
		return Response.json({ busStopId, message: "本日の残りのバスはありません" });
	}

	return Response.json({
		busStopId,
		busStopName: next.busStopName,
		nextDeparture: {
			hour: next.hour,
			minute: next.minute,
			formatted: formatTime(next.hour, next.minute),
		},
	});
}
