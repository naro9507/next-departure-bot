import type { IRequest } from "itty-router";
import { createDb } from "../db/client";
import { getAllBusStops, getNextDeparture } from "../repository/timeTable";
import type { Env } from "../types";
import { formatTime, getJSTTime } from "../utils/time";

async function verifySignature(
	body: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
	const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
	return signature === expected;
}

interface LineTextMessage {
	type: "text";
	text: string;
}

interface LineMessageEvent {
	type: "message";
	replyToken: string;
	message: LineTextMessage | { type: string };
}

async function sendReply(
	replyToken: string,
	text: string,
	accessToken: string,
): Promise<void> {
	await fetch("https://api.line.me/v2/bot/message/reply", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify({
			replyToken,
			messages: [{ type: "text", text }],
		}),
	});
}

function parseBusStopId(text: string): number | null {
	const t = text.trim();
	if (/^[1１一]$/.test(t) || t.includes("1番") || t.includes("バス停1")) return 1;
	if (/^[2２二]$/.test(t) || t.includes("2番") || t.includes("バス停2")) return 2;
	const n = parseInt(t, 10);
	return isNaN(n) || n <= 0 ? null : n;
}

export async function handleLine(req: IRequest, env: Env): Promise<Response> {
	const body = await req.text();
	const signature = req.headers.get("x-line-signature") ?? "";

	const valid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
	if (!valid) {
		return new Response("Invalid signature", { status: 401 });
	}

	let webhook: { events: LineMessageEvent[] };
	try {
		webhook = JSON.parse(body);
	} catch {
		return new Response("Bad Request", { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);

	for (const event of webhook.events) {
		if (event.type !== "message" || event.message.type !== "text") continue;

		const text = (event.message as LineTextMessage).text;
		const busStopId = parseBusStopId(text);

		if (busStopId === null) {
			const stops = await getAllBusStops(db);
			const list = stops.map((s) => `${s.id}: ${s.name}`).join("\n");
			await sendReply(
				event.replyToken,
				`バス停番号を送ってください\n${list}`,
				env.LINE_CHANNEL_ACCESS_TOKEN,
			);
			continue;
		}

		const { hour, minute, dayType } = getJSTTime();
		const next = await getNextDeparture(db, busStopId, dayType, hour, minute);

		if (!next) {
			await sendReply(
				event.replyToken,
				"本日の残りのバスはありません",
				env.LINE_CHANNEL_ACCESS_TOKEN,
			);
		} else {
			await sendReply(
				event.replyToken,
				`${next.busStopName}の次のバス: ${formatTime(next.hour, next.minute)}発`,
				env.LINE_CHANNEL_ACCESS_TOKEN,
			);
		}
	}

	// LINE expects 200 OK
	return new Response("OK");
}
