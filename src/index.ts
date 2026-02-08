import { Hono } from "hono";

const app = new Hono();

app.get("/search", (c) => {
	return c.text("Hello Hono!");
});

export default app;
