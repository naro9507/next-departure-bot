import type { IRequest } from "itty-router";
import { createDb } from "../db/client";
import { getBusStopById, getNextDeparture } from "../repository/timeTable";
import type { Env } from "../types";
import { formatTimeForSpeech, getJSTTime } from "../utils/time";

interface AlexaRequest {
	version: string;
	session?: {
		application?: { applicationId?: string };
	};
	context?: {
		System?: { application?: { applicationId?: string } };
	};
	request: {
		type: string;
		timestamp?: string;
		intent?: {
			name: string;
			slots?: Record<string, { name: string; value?: string }>;
		};
	};
}

/** Alexa の要件: リクエストのタイムスタンプが ±150 秒以内であること (リプレイ攻撃対策) */
const TIMESTAMP_TOLERANCE_MS = 150 * 1000;

const HELP_TEXT =
	"バス時刻案内です。「1番」や「2番」のようにバス停番号を教えてください。";

function alexaResponse(
	text: string,
	options: { endSession?: boolean; reprompt?: string } = {},
): Response {
	const { endSession = true, reprompt } = options;
	return Response.json({
		version: "1.0",
		response: {
			outputSpeech: { type: "PlainText", text },
			...(reprompt && {
				reprompt: { outputSpeech: { type: "PlainText", text: reprompt } },
			}),
			shouldEndSession: endSession,
		},
	});
}

function askAgain(text: string): Response {
	return alexaResponse(text, {
		endSession: false,
		reprompt: "バス停番号を教えてください",
	});
}

function getApplicationId(body: AlexaRequest): string | undefined {
	return body.context?.System?.application?.applicationId
		?? body.session?.application?.applicationId;
}

function isTimestampValid(timestamp: string | undefined): boolean {
	if (!timestamp) return false;
	const ts = Date.parse(timestamp);
	return !isNaN(ts) && Math.abs(Date.now() - ts) <= TIMESTAMP_TOLERANCE_MS;
}

async function handleGetNextBus(
	body: AlexaRequest,
	env: Env,
): Promise<Response> {
	const value = body.request.intent?.slots?.["BusStop"]?.value;
	const busStopId = value ? parseInt(value, 10) : NaN;

	if (isNaN(busStopId) || busStopId <= 0) {
		return askAgain("バス停番号を教えてください");
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	const busStop = await getBusStopById(db, busStopId);
	if (!busStop) {
		return askAgain(
			`${busStopId}番のバス停は見つかりませんでした。別の番号を教えてください`,
		);
	}

	const next = await getNextDeparture(db, busStopId, getJSTTime());
	if (!next) {
		return alexaResponse(`${busStop.name}の本日の残りのバスはありません`);
	}

	return alexaResponse(
		`${busStop.name}の次のバスは${formatTimeForSpeech(next.hour, next.minute)}です`,
	);
}

export async function handleAlexa(req: IRequest, env: Env): Promise<Response> {
	let body: AlexaRequest;
	try {
		body = await req.json();
	} catch {
		return new Response("Bad Request", { status: 400 });
	}
	if (!body?.request?.type) {
		return new Response("Bad Request", { status: 400 });
	}

	if (env.ALEXA_APP_ID && getApplicationId(body) !== env.ALEXA_APP_ID) {
		return new Response("Forbidden", { status: 403 });
	}

	if (!isTimestampValid(body.request.timestamp)) {
		return new Response("Bad Request", { status: 400 });
	}

	const { type } = body.request;

	if (type === "LaunchRequest") {
		return askAgain(
			"バス時刻案内です。何番のバス停ですか？番号を教えてください。",
		);
	}

	// SessionEndedRequest には音声を含めずに応答する (Alexa の仕様)
	if (type === "SessionEndedRequest") {
		return Response.json({ version: "1.0", response: {} });
	}

	if (type === "IntentRequest") {
		switch (body.request.intent?.name) {
			case "GetNextBusIntent":
				return handleGetNextBus(body, env);
			case "AMAZON.HelpIntent":
			case "AMAZON.FallbackIntent":
				return askAgain(HELP_TEXT);
			case "AMAZON.StopIntent":
			case "AMAZON.CancelIntent":
				return alexaResponse("ご利用ありがとうございました");
		}
	}

	return alexaResponse("リクエストを処理できませんでした");
}
