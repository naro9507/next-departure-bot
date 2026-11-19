import { describe, expect, test } from "bun:test";
import type { IRequest } from "itty-router";
import { handleAlexa } from "../src/handlers/alexa";
import type { Env } from "../src/types";

const env = { ALEXA_APP_ID: "amzn1.ask.skill.test" } as Env;

function makeRequest(request: Record<string, unknown>, appId = env.ALEXA_APP_ID) {
	const body = {
		version: "1.0",
		context: { System: { application: { applicationId: appId } } },
		request: { timestamp: new Date().toISOString(), ...request },
	};
	return new Request("https://example.com/alexa", {
		method: "POST",
		body: JSON.stringify(body),
	}) as unknown as IRequest;
}

describe("handleAlexa (DB を使わない経路)", () => {
	test("LaunchRequest はセッションを継続し reprompt を返す", async () => {
		const res = await handleAlexa(makeRequest({ type: "LaunchRequest" }), env);
		const json = await res.json() as { response: { shouldEndSession: boolean; reprompt?: unknown } };
		expect(json.response.shouldEndSession).toBe(false);
		expect(json.response.reprompt).toBeDefined();
	});

	test("SessionEndedRequest は空の response", async () => {
		const res = await handleAlexa(makeRequest({ type: "SessionEndedRequest" }), env);
		expect(await res.json()).toEqual({ version: "1.0", response: {} });
	});

	test("アプリケーション ID が違えば 403", async () => {
		const res = await handleAlexa(makeRequest({ type: "LaunchRequest" }, "other"), env);
		expect(res.status).toBe(403);
	});

	test("タイムスタンプが古ければ 400", async () => {
		const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		const res = await handleAlexa(makeRequest({ type: "LaunchRequest", timestamp: old }), env);
		expect(res.status).toBe(400);
	});

	test("スロットが無ければ聞き返す", async () => {
		const res = await handleAlexa(
			makeRequest({ type: "IntentRequest", intent: { name: "GetNextBusIntent", slots: {} } }),
			env,
		);
		const json = await res.json() as { response: { shouldEndSession: boolean } };
		expect(json.response.shouldEndSession).toBe(false);
	});
});
