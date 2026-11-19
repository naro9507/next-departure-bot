/**
 * ルーター (src/index.ts) 経由の結合テスト。
 * DB はインメモリ libSQL に差し替え、LINE の返信 API は fetch をモックする。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import type { Db } from "../src/db/client";
import type { Env } from "../src/types";
import { createSessionValue } from "../src/utils/session";
import { createTestDb } from "./helpers/testDb";

let db: Db;
mock.module("../src/db/client", () => ({ createDb: () => db }));
const { default: worker } = await import("../src/index");

const env: Env = {
	TURSO_DATABASE_URL: "unused",
	TURSO_AUTH_TOKEN: "unused",
	LINE_CHANNEL_SECRET: "line-secret",
	LINE_CHANNEL_ACCESS_TOKEN: "line-token",
	ALEXA_APP_ID: "amzn1.ask.skill.test",
	ADMIN_API_TOKEN: "admin-token",
};
const ctx = {} as ExecutionContext;
const BASE = "https://bot.example.com";

function call(path: string, init?: RequestInit) {
	return worker.fetch(new Request(BASE + path, init), env, ctx);
}

// 2026-11-19 (木) 12:00 JST
const NOW = new Date("2026-11-19T12:00:00+09:00");

beforeAll(() => setSystemTime(NOW));
afterAll(() => setSystemTime());

beforeEach(async () => {
	setSystemTime(NOW);
	db = await createTestDb();
});

async function adminCookie() {
	return `admin_session=${await createSessionValue(env.ADMIN_API_TOKEN)}`;
}

async function admin(method: string, path: string, body?: unknown) {
	return call(path, {
		method,
		headers: { Cookie: await adminCookie(), "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

/** 管理 API でバス停 + 時刻表を作る */
async function seed() {
	const stop = await (await admin("POST", "/admin/api/bus-stops", { name: "駅前" })).json() as { id: number };
	await admin("POST", "/admin/api/timetable/bulk", {
		busStopId: stop.id,
		dayType: "weekday",
		text: "6: 30\n12: 15 45\n23: 50\n24: 20",
	});
	await admin("POST", "/admin/api/timetable/bulk", {
		busStopId: stop.id,
		dayType: "holiday",
		text: "7:00 24:10",
	});
	return stop.id;
}

// ---------------------------------------------------------------- /search

describe("GET /search", () => {
	test("次の発車時刻を返す", async () => {
		const id = await seed();
		const res = await call(`/search?busStopId=${id}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			busStopId: id,
			busStopName: "駅前",
			nextDeparture: { hour: 12, minute: 15, formatted: "12:15" },
		});
	});

	test("今日の残りの便が深夜便なら (翌日) 表記", async () => {
		const id = await seed();
		setSystemTime(new Date("2026-11-19T23:55:00+09:00"));
		const json = await (await call(`/search?busStopId=${id}`)).json() as { nextDeparture: { formatted: string } };
		expect(json.nextDeparture.formatted).toBe("00:20(翌日)");
	});

	test("日付をまたいだ直後は前日ダイヤの深夜便", async () => {
		const id = await seed();
		setSystemTime(new Date("2026-11-20T00:05:00+09:00"));
		const json = await (await call(`/search?busStopId=${id}`)).json() as { nextDeparture: { formatted: string } };
		expect(json.nextDeparture.formatted).toBe("00:20");
	});

	test("祝日 (勤労感謝の日) は休日ダイヤ", async () => {
		const id = await seed();
		setSystemTime(new Date("2026-11-23T06:00:00+09:00"));
		const json = await (await call(`/search?busStopId=${id}`)).json() as { nextDeparture: { formatted: string } };
		expect(json.nextDeparture.formatted).toBe("07:00");
	});

	test("土曜はダイヤが無いので残りなし", async () => {
		const id = await seed();
		setSystemTime(new Date("2026-11-21T12:00:00+09:00"));
		const json = await (await call(`/search?busStopId=${id}`)).json() as { message: string };
		expect(json.message).toBe("本日の残りのバスはありません");
	});

	test("400 / 404", async () => {
		expect((await call("/search")).status).toBe(400);
		expect((await call("/search?busStopId=abc")).status).toBe(400);
		expect((await call("/search?busStopId=999")).status).toBe(404);
	});
});

// ---------------------------------------------------------------- /line

async function lineSign(body: string, secret = env.LINE_CHANNEL_SECRET) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe("POST /line", () => {
	const replies: { token: string; text: string; auth: string }[] = [];
	const realFetch = globalThis.fetch;

	beforeEach(() => {
		replies.length = 0;
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input instanceof Request ? input.url : input);
			if (url !== "https://api.line.me/v2/bot/message/reply") throw new Error(`unexpected fetch ${url}`);
			const body = JSON.parse(String(init?.body));
			replies.push({
				token: body.replyToken,
				text: body.messages[0].text,
				auth: new Headers(init?.headers).get("Authorization") ?? "",
			});
			return new Response("{}");
		}) as typeof fetch;
	});
	afterAll(() => {
		globalThis.fetch = realFetch;
	});

	async function sendLine(texts: string[], secret?: string) {
		const body = JSON.stringify({
			events: texts.map((text, i) => ({
				type: "message",
				replyToken: `r${i}`,
				message: { type: "text", text },
			})),
		});
		return call("/line", {
			method: "POST",
			headers: { "x-line-signature": await lineSign(body, secret) },
			body,
		});
	}

	test("番号の書き方ごとに返信する", async () => {
		const id = await seed();
		const res = await sendLine([String(id), "１", "一番", "バス停 1", "一覧", "99"]);
		expect(res.status).toBe(200);
		expect(replies.map((r) => r.text)).toEqual([
			"駅前の次のバス: 12:15発",
			"駅前の次のバス: 12:15発",
			"駅前の次のバス: 12:15発",
			"駅前の次のバス: 12:15発",
			"バス停番号を送ってください\n1: 駅前",
			"99番のバス停は見つかりませんでした。\n「一覧」と送るとバス停の一覧を表示します",
		]);
		expect(replies[0].auth).toBe("Bearer line-token");
		expect(replies.map((r) => r.token)).toEqual(["r0", "r1", "r2", "r3", "r4", "r5"]);
	});

	test("残りのバスが無い場合", async () => {
		await seed();
		setSystemTime(new Date("2026-11-21T12:00:00+09:00"));
		await sendLine(["1"]);
		expect(replies[0].text).toBe("駅前の本日の残りのバスはありません");
	});

	test("署名が不正なら 401 で返信しない", async () => {
		await seed();
		const res = await sendLine(["1"], "wrong-secret");
		expect(res.status).toBe(401);
		expect(replies).toHaveLength(0);

		const noSig = await call("/line", { method: "POST", body: "{}" });
		expect(noSig.status).toBe(401);

		const badB64 = await call("/line", { method: "POST", headers: { "x-line-signature": "!!!" }, body: "{}" });
		expect(badB64.status).toBe(401);
	});

	test("返信 API が通信エラーでも 200 を返し、残りのイベントは処理する", async () => {
		await seed();
		const ok = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls++;
			if (calls === 1) throw new TypeError("network error");
			return ok(input, init);
		}) as typeof fetch;
		const res = await sendLine(["1", "1"]);
		expect(res.status).toBe(200);
		expect(replies.map((r) => r.token)).toEqual(["r1"]);
	});

	test("テキスト以外のイベント・検証用の空イベントは無視して 200", async () => {
		const body = JSON.stringify({
			events: [
				{ type: "message", replyToken: "s", message: { type: "sticker" } },
				{ type: "follow", replyToken: "f" },
			],
		});
		const res = await call("/line", { method: "POST", headers: { "x-line-signature": await lineSign(body) }, body });
		expect(res.status).toBe(200);
		expect(replies).toHaveLength(0);

		const empty = JSON.stringify({ destination: "x", events: [] });
		const res2 = await call("/line", { method: "POST", headers: { "x-line-signature": await lineSign(empty) }, body: empty });
		expect(res2.status).toBe(200);
	});
});

// ---------------------------------------------------------------- /alexa

describe("POST /alexa", () => {
	async function alexa(request: Record<string, unknown>) {
		const res = await call("/alexa", {
			method: "POST",
			body: JSON.stringify({
				version: "1.0",
				context: { System: { application: { applicationId: env.ALEXA_APP_ID } } },
				request: { timestamp: new Date().toISOString(), ...request },
			}),
		});
		return (await res.json()) as {
			response: { outputSpeech?: { text: string }; shouldEndSession?: boolean };
		};
	}
	const intent = (value?: string) => ({
		type: "IntentRequest",
		intent: { name: "GetNextBusIntent", slots: { BusStop: { name: "BusStop", value } } },
	});

	test("次のバスを読み上げる", async () => {
		await seed();
		const json = await alexa(intent("1"));
		expect(json.response.outputSpeech?.text).toBe("駅前の次のバスは12時15分です");
		expect(json.response.shouldEndSession).toBe(true);
	});

	test("深夜便は「深夜」、ちょうどは分なし", async () => {
		await seed();
		setSystemTime(new Date("2026-11-19T23:55:00+09:00"));
		expect((await alexa(intent("1"))).response.outputSpeech?.text).toBe("駅前の次のバスは深夜0時20分です");
		setSystemTime(new Date("2026-11-23T06:00:00+09:00"));
		expect((await alexa(intent("1"))).response.outputSpeech?.text).toBe("駅前の次のバスは7時です");
	});

	test("存在しないバス停・番号なしは聞き返す", async () => {
		await seed();
		const notFound = await alexa(intent("9"));
		expect(notFound.response.outputSpeech?.text).toContain("見つかりませんでした");
		expect(notFound.response.shouldEndSession).toBe(false);
		expect((await alexa(intent(undefined))).response.shouldEndSession).toBe(false);
	});

	test("Stop / Help", async () => {
		const stop = await alexa({ type: "IntentRequest", intent: { name: "AMAZON.StopIntent" } });
		expect(stop.response.shouldEndSession).toBe(true);
		const help = await alexa({ type: "IntentRequest", intent: { name: "AMAZON.HelpIntent" } });
		expect(help.response.shouldEndSession).toBe(false);
	});
});

// ---------------------------------------------------------------- /admin

describe("管理画面・管理 API", () => {
	test("GET /admin は HTML", async () => {
		const res = await call("/admin");
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("text/html");
		expect(await res.text()).toContain("まとめて登録");
	});

	test("Cookie が無い・改ざん・期限切れなら 401", async () => {
		expect((await call("/admin/api/bus-stops")).status).toBe(401);

		const tampered = await call("/admin/api/bus-stops", { headers: { Cookie: "admin_session=123.abc" } });
		expect(tampered.status).toBe(401);

		const cookie = await adminCookie();
		setSystemTime(new Date(NOW.getTime() + 25 * 60 * 60 * 1000));
		expect((await call("/admin/api/bus-stops", { headers: { Cookie: cookie } })).status).toBe(401);
	});

	test("別の鍵で署名した Cookie は 401", async () => {
		const forged = `admin_session=${await createSessionValue("other-secret")}`;
		expect((await call("/admin/api/bus-stops", { headers: { Cookie: forged } })).status).toBe(401);
	});

	test("バス停・時刻の CRUD", async () => {
		const stop = await (await admin("POST", "/admin/api/bus-stops", { name: "公園" })).json() as { id: number };
		expect((await (await admin("GET", "/admin/api/bus-stops")).json() as unknown[]).length).toBe(1);

		const created = await admin("POST", "/admin/api/timetable", { busStopId: stop.id, dayType: "saturday", hour: 9, minute: 5 });
		expect(created.status).toBe(201);
		const entry = await created.json() as { id: number };

		const list = await (await admin("GET", `/admin/api/timetable/${stop.id}?dayType=saturday`)).json() as unknown[];
		expect(list).toHaveLength(1);

		expect((await admin("DELETE", `/admin/api/timetable/${entry.id}`)).status).toBe(204);
		expect(await (await admin("GET", `/admin/api/timetable/${stop.id}`)).json()).toEqual([]);

		expect((await admin("DELETE", `/admin/api/bus-stops/${stop.id}`)).status).toBe(204);
		expect(await (await admin("GET", "/admin/api/bus-stops")).json()).toEqual([]);
	});

	test("入力バリデーション", async () => {
		expect((await admin("POST", "/admin/api/bus-stops", { name: "" })).status).toBe(400);
		expect((await admin("POST", "/admin/api/bus-stops", { name: "x".repeat(101) })).status).toBe(400);
		expect((await admin("POST", "/admin/api/timetable", { busStopId: 1, dayType: "weekday", hour: 31, minute: 0 })).status).toBe(400);
		expect((await admin("POST", "/admin/api/timetable", { busStopId: 1, dayType: "sunday", hour: 6, minute: 0 })).status).toBe(400);
		expect((await admin("DELETE", "/admin/api/timetable/abc")).status).toBe(400);
	});

	describe("POST /admin/api/timetable/bulk", () => {
		test("追加 → 重複スキップ → 置き換え", async () => {
			const stop = await (await admin("POST", "/admin/api/bus-stops", { name: "駅前" })).json() as { id: number };
			const bulk = (text: string, replace = false) =>
				admin("POST", "/admin/api/timetable/bulk", { busStopId: stop.id, dayType: "weekday", text, replace });

			let res = await bulk("6: 05 25 45\n7: 00");
			expect(res.status).toBe(201);
			expect(await res.json()).toEqual({ added: 4, skipped: 0, deleted: 0 });

			res = await bulk("6:45, 7:00, 7:30");
			expect(await res.json()).toEqual({ added: 1, skipped: 2, deleted: 0 });

			res = await bulk("8:00", true);
			expect(await res.json()).toEqual({ added: 1, skipped: 0, deleted: 5 });
			const rows = await (await admin("GET", `/admin/api/timetable/${stop.id}?dayType=weekday`)).json() as { hour: number }[];
			expect(rows.map((r) => r.hour)).toEqual([8]);
		});

		test("解釈できない行があれば何も登録しない", async () => {
			const stop = await (await admin("POST", "/admin/api/bus-stops", { name: "駅前" })).json() as { id: number };
			const res = await admin("POST", "/admin/api/timetable/bulk", { busStopId: stop.id, dayType: "weekday", text: "6:30\n7:7x" });
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: "解釈できない時刻があります", details: ["2行目: 7:7x"] });
			expect(await (await admin("GET", `/admin/api/timetable/${stop.id}`)).json()).toEqual([]);
		});

		test("存在しないバス停は 404、未ログインは 401、空は 400、上限超過は 400", async () => {
			expect((await admin("POST", "/admin/api/timetable/bulk", { busStopId: 99, dayType: "weekday", text: "6:30" })).status).toBe(404);
			expect((await call("/admin/api/timetable/bulk", { method: "POST", body: "{}" })).status).toBe(401);
			const stop = await (await admin("POST", "/admin/api/bus-stops", { name: "駅前" })).json() as { id: number };
			expect((await admin("POST", "/admin/api/timetable/bulk", { busStopId: stop.id, dayType: "weekday", text: "   \n " })).status).toBe(400);
			const many = Array.from({ length: 31 * 60 }, (_, i) => `${Math.floor(i / 60)}:${i % 60}`).slice(0, 501).join(" ");
			expect((await admin("POST", "/admin/api/timetable/bulk", { busStopId: stop.id, dayType: "weekday", text: many })).status).toBe(400);
		});
	});

	describe("パスキー認証 API", () => {
		test("未登録状態", async () => {
			expect(await (await call("/admin/api/auth/status")).json()).toEqual({ registered: false });
		});

		test("登録開始はブートストラップトークンが必要", async () => {
			expect((await call("/admin/api/auth/register/start", { method: "POST" })).status).toBe(401);
			const bad = await call("/admin/api/auth/register/start", { method: "POST", headers: { Authorization: "Bearer wrong" } });
			expect(bad.status).toBe(401);

			const ok = await call("/admin/api/auth/register/start", { method: "POST", headers: { Authorization: "Bearer admin-token" } });
			expect(ok.status).toBe(200);
			const json = await ok.json() as { options: { rp: { id: string }; challenge: string }; signedChallenge: string };
			expect(json.options.rp.id).toBe("bot.example.com");
			expect(json.signedChallenge).toContain(json.options.challenge);
		});

		test("不正なボディ・改ざんチャレンジは 400", async () => {
			const finish = (body: unknown) =>
				call("/admin/api/auth/login/finish", { method: "POST", body: JSON.stringify(body) });
			expect((await finish({})).status).toBe(400);
			const res = await finish({ credential: { id: "x" }, signedChallenge: `${Date.now()}|abc|forged` });
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: "Challenge expired or invalid" });
		});

		test("ログアウトは Cookie を消す", async () => {
			const res = await call("/admin/api/auth/logout", { method: "POST" });
			expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
			expect(res.headers.get("Set-Cookie")).toContain("HttpOnly");
		});
	});
});

test("未定義のパスは 404", async () => {
	expect((await call("/unknown")).status).toBe(404);
});
