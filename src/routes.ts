import { Hono } from "hono";

export const routes = new Hono();

routes.get("/", (c) => {
	return c.text("Hello Hono!");
});
