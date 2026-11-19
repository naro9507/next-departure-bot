import type { IRequest } from "itty-router";
import { createDb } from "../db/client";
import {
	getAllBusStops,
	getBusStopById,
	getNextDeparture,
} from "../repository/timeTable";
import type { Env } from "../types";
import { parseBusStopId } from "../utils/parseBusStopId";
import { formatTime, getJSTTime } from "../utils/time";

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
	try {
		return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

/** crypto.subtle.verify で比較するのでタイミング攻撃に強い */
async function verifySignature(
	body: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	const sig = base64ToBytes(signature);
	if (!sig) return false;
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);
	return crypto.subtle.verify("HMAC", key, sig, enc.encode(body));
}

interface LineTextMessage {
	type: "text";
	text: string;
}

interface LineEvent {
	type: string;
	replyToken?: string;
	message?: LineTextMessage | { type: string };
}

async function sendReply(
	replyToken: string,
	text: string,
	accessToken: string,
): Promise<void> {
	const res = await fetch("https://api.line.me/v2/bot/message/reply", {
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
	if (!res.ok) {
		// Workers のログで返信失敗を追えるようにする
		// oxlint-disable-next-line no-console
		console.error("LINE reply failed", res.status, await res.text());
	}
}

function isTextMessageEvent(
	event: LineEvent,
): event is LineEvent & { replyToken: string; message: LineTextMessage } {
	return event.type === "message"
		&& typeof event.replyToken === "string"
		&& event.message?.type === "text";
}

export async function handleLine(req: IRequest, env: Env): Promise<Response> {
	const body = await req.text();
	const signature = req.headers.get("x-line-signature") ?? "";

	const valid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
	if (!valid) {
		return new Response("Invalid signature", { status: 401 });
	}

	let webhook: { events?: LineEvent[] };
	try {
		webhook = JSON.parse(body);
	} catch {
		return new Response("Bad Request", { status: 400 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);

	for (const event of webhook.events ?? []) {
		if (!isTextMessageEvent(event)) continue;

		const reply = (text: string) =>
			sendReply(event.replyToken, text, env.LINE_CHANNEL_ACCESS_TOKEN);

		const busStopId = parseBusStopId(event.message.text);

		if (busStopId === null) {
			const stops = await getAllBusStops(db);
			const list = stops.map((s) => `${s.id}: ${s.name}`).join("\n");
			await reply(`バス停番号を送ってください\n${list}`);
			continue;
		}

		const busStop = await getBusStopById(db, busStopId);
		if (!busStop) {
			await reply(
				`${busStopId}番のバス停は見つかりませんでした。\n「一覧」と送るとバス停の一覧を表示します`,
			);
			continue;
		}

		const next = await getNextDeparture(db, busStopId, getJSTTime());
		await reply(
			next
				? `${busStop.name}の次のバス: ${formatTime(next.hour, next.minute)}発`
				: `${busStop.name}の本日の残りのバスはありません`,
		);
	}

	// LINE expects 200 OK
	return new Response("OK");
}
