import { AutoRouter } from "itty-router";
import {
	handleCreateBusStop,
	handleCreateTimetable,
	handleDeleteBusStop,
	handleDeleteTimetable,
	handleGetBusStops,
	handleGetTimetable,
} from "./handlers/admin";
import { renderAdminPage } from "./handlers/adminPage";
import { handleAlexa } from "./handlers/alexa";
import { handleLine } from "./handlers/line";
import { handleSearch } from "./handlers/search";
import type { Env } from "./types";

const router = AutoRouter();

router
	// Public
	.get("/search", handleSearch)
	.post("/line", handleLine)
	.post("/alexa", handleAlexa)
	// Admin page
	.get("/admin", () => renderAdminPage())
	.get("/admin/api/bus-stops", handleGetBusStops)
	.post("/admin/api/bus-stops", handleCreateBusStop)
	.delete("/admin/api/bus-stops/:id", handleDeleteBusStop)
	.get("/admin/api/timetable/:busStopId", handleGetTimetable)
	.post("/admin/api/timetable", handleCreateTimetable)
	.delete("/admin/api/timetable/:id", handleDeleteTimetable);

export default {
	fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
		router.fetch(req, env, ctx),
};
