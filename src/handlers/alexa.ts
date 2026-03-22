import type { IRequest } from "itty-router";
import { createDb } from "../db/client";
import { getNextDeparture } from "../repository/timeTable";
import type { Env } from "../types";
import { getJSTTime } from "../utils/time";

interface AlexaRequest {
	version: string;
	session: {
		application: { applicationId: string };
	};
	request: {
		type: string;
		intent?: {
			name: string;
			slots?: Record<string, { name: string; value?: string }>;
		};
	};
}

function alexaResponse(text: string, endSession = true): Response {
	return Response.json({
		version: "1.0",
		response: {
			outputSpeech: { type: "PlainText", text },
			shouldEndSession: endSession,
		},
	});
}

export async function handleAlexa(req: IRequest, env: Env): Promise<Response> {
	let body: AlexaRequest;
	try {
		body = await req.json();
	} catch {
		return alexaResponse("リクエストを解析できませんでした");
	}

	if (env.ALEXA_APP_ID && body.session.application.applicationId !== env.ALEXA_APP_ID) {
		return alexaResponse("無効なアプリケーションです");
	}

	const { type } = body.request;

	if (type === "LaunchRequest") {
		return alexaResponse(
			"バス時刻案内です。何番のバス停ですか？番号を教えてください。",
			false,
		);
	}

	if (type === "IntentRequest") {
		const intentName = body.request.intent?.name;

		if (intentName === "GetNextBusIntent") {
			const value = body.request.intent?.slots?.["BusStop"]?.value;
			const busStopId = value ? parseInt(value, 10) : NaN;

			if (isNaN(busStopId)) {
				return alexaResponse("バス停番号を教えてください", false);
			}

			const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
			const { hour, minute, dayType } = getJSTTime();
			const next = await getNextDeparture(db, busStopId, dayType, hour, minute);

			if (!next) {
				return alexaResponse(`${busStopId}番バス停の本日の残りのバスはありません`);
			}

			return alexaResponse(
				`${next.busStopName}の次のバスは${next.hour}時${next.minute}分です`,
			);
		}

		if (intentName === "AMAZON.HelpIntent") {
			return alexaResponse(
				"バス時刻案内です。「1番」や「2番」のようにバス停番号を教えてください。",
				false,
			);
		}

		if (
			intentName === "AMAZON.StopIntent" ||
			intentName === "AMAZON.CancelIntent"
		) {
			return alexaResponse("ご利用ありがとうございました");
		}
	}

	return alexaResponse("リクエストを処理できませんでした");
}
