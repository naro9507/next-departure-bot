import { AutoRouter } from "itty-router";
import {
	handleCreateBusStop,
	handleCreateTimetable,
	handleDeleteTimetable,
	handleGetBusStops,
	handleGetTimetable,
} from "./handlers/admin";
import { handleAlexa } from "./handlers/alexa";
import { handleLine } from "./handlers/line";
import { handleSearch } from "./handlers/search";
import type { Env } from "./types";

const router = AutoRouter();

router
	.get("/search", handleSearch)
	.post("/line", handleLine)
	.post("/alexa", handleAlexa)
	.get("/admin/bus-stops", handleGetBusStops)
	.post("/admin/bus-stops", handleCreateBusStop)
	.get("/admin/timetable/:busStopId", handleGetTimetable)
	.post("/admin/timetable", handleCreateTimetable)
	.delete("/admin/timetable/:id", handleDeleteTimetable);

export default {
	fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
		router.fetch(req, env, ctx),
};
