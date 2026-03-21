import { AutoRouter } from "itty-router";
import type { IRequest } from "itty-router";
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

function checkAdminIp(req: IRequest, env: Env): Response | null {
	const allowedIps = env.ADMIN_ALLOWED_IPS;
	if (!allowedIps) return null; // 未設定なら制限なし

	const clientIp =
		req.headers.get("CF-Connecting-IP") ??
		req.headers.get("X-Forwarded-For")?.split(",")[0].trim();

	const allowed = allowedIps.split(",").map((ip) => ip.trim());
	if (!clientIp || !allowed.includes(clientIp)) {
		return new Response("Forbidden", { status: 403 });
	}
	return null;
}

const router = AutoRouter();

router
	// Public
	.get("/search", handleSearch)
	.post("/line", handleLine)
	.post("/alexa", handleAlexa)
	// Admin page (IP restricted)
	.get("/admin", (req: IRequest, env: Env) => {
		const ipError = checkAdminIp(req, env);
		if (ipError) return ipError;
		return renderAdminPage();
	})
	// Admin API (IP restricted)
	.all("/admin/api/*", (req: IRequest, env: Env) => checkAdminIp(req, env) ?? undefined)
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
