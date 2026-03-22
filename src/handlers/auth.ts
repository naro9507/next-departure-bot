import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { IRequest } from "itty-router";
import { createDb } from "../db/client";
import {
	getPasskeyById,
	hasPasskey,
	listPasskeys,
	savePasskey,
	updatePasskeyCounter,
} from "../repository/passkey";
import type { Env } from "../types";
import {
	createSessionValue,
	makeClearCookieHeader,
	makeSetCookieHeader,
} from "../utils/session";

// --- base64url helpers ---

function bufToB64u(buf: Uint8Array): string {
	return btoa(String.fromCharCode(...buf))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

function b64uToBuf(b64u: string): Uint8Array<ArrayBuffer> {
	const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
	const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + pad;
	const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	return new Uint8Array(bytes.buffer.slice(0) as ArrayBuffer);
}

// --- signed challenge (stateless, HMAC-protected) ---
// format: "<timestamp>|<challenge>|<hmac-sig-b64u>"
// challenge is base64url so it never contains "|"

async function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

async function signChallenge(
	challenge: string,
	secret: string,
): Promise<string> {
	const ts = Date.now();
	const payload = `${ts}|${challenge}`;
	const key = await importHmacKey(secret);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	return `${payload}|${bufToB64u(new Uint8Array(sig))}`;
}

async function extractChallenge(
	signed: string,
	secret: string,
): Promise<string | null> {
	const parts = signed.split("|");
	if (parts.length !== 3) return null;
	const [tsStr, challenge, sigB64u] = parts;
	const ts = parseInt(tsStr, 10);
	if (isNaN(ts) || Date.now() - ts > 5 * 60 * 1000) return null; // 5 min TTL
	const payload = `${tsStr}|${challenge}`;
	const key = await importHmacKey(secret);
	try {
		const valid = await crypto.subtle.verify(
			"HMAC",
			key,
			b64uToBuf(sigB64u),
			new TextEncoder().encode(payload),
		);
		return valid ? challenge : null;
	} catch {
		return null;
	}
}

// --- RP info ---

function getRpInfo(req: IRequest) {
	const url = new URL(req.url);
	return { rpID: url.hostname, origin: url.origin };
}

// --- handlers ---

export async function handleAuthStatus(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	const registered = await hasPasskey(db);
	return Response.json({ registered });
}

/** 初回パスキー登録開始 — ADMIN_API_TOKEN をブートストラップ認証に使用 */
export async function handleRegisterStart(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const auth = req.headers.get("Authorization");
	if (!auth || auth !== `Bearer ${env.ADMIN_API_TOKEN}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	const existing = await listPasskeys(db);
	const { rpID } = getRpInfo(req);

	const options = await generateRegistrationOptions({
		rpName: "バス時刻表管理",
		rpID,
		userName: "admin",
		attestationType: "none",
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred",
		},
		excludeCredentials: existing.map((c) => ({ id: c.id })),
	});

	const signedChallenge = await signChallenge(
		options.challenge,
		env.ADMIN_API_TOKEN,
	);
	return Response.json({ options, signedChallenge });
}

export async function handleRegisterFinish(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const auth = req.headers.get("Authorization");
	if (!auth || auth !== `Bearer ${env.ADMIN_API_TOKEN}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = (await req.json().catch(() => null)) as {
		credential: RegistrationResponseJSON;
		signedChallenge: string;
	} | null;
	if (!body?.credential || !body?.signedChallenge) {
		return Response.json({ error: "Invalid body" }, { status: 400 });
	}

	const expectedChallenge = await extractChallenge(
		body.signedChallenge,
		env.ADMIN_API_TOKEN,
	);
	if (!expectedChallenge) {
		return Response.json(
			{ error: "Challenge expired or invalid" },
			{ status: 400 },
		);
	}

	const { rpID, origin } = getRpInfo(req);
	let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
	try {
		verification = await verifyRegistrationResponse({
			response: body.credential,
			expectedChallenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification: false,
		});
	} catch (e) {
		return Response.json(
			{ error: "Verification failed", detail: String(e) },
			{ status: 400 },
		);
	}

	if (!verification.verified || !verification.registrationInfo) {
		return Response.json({ error: "Verification failed" }, { status: 400 });
	}

	const { credential } = verification.registrationInfo;
	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	await savePasskey(
		db,
		credential.id,
		bufToB64u(credential.publicKey),
		credential.counter,
	);
	return Response.json({ ok: true });
}

export async function handleLoginStart(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	const credentials = await listPasskeys(db);
	const { rpID } = getRpInfo(req);

	const options = await generateAuthenticationOptions({
		rpID,
		userVerification: "preferred",
		allowCredentials: credentials.map((c) => ({ id: c.id })),
	});

	const signedChallenge = await signChallenge(
		options.challenge,
		env.ADMIN_API_TOKEN,
	);
	return Response.json({ options, signedChallenge });
}

export async function handleLoginFinish(
	req: IRequest,
	env: Env,
): Promise<Response> {
	const body = (await req.json().catch(() => null)) as {
		credential: AuthenticationResponseJSON;
		signedChallenge: string;
	} | null;
	if (!body?.credential || !body?.signedChallenge) {
		return Response.json({ error: "Invalid body" }, { status: 400 });
	}

	const expectedChallenge = await extractChallenge(
		body.signedChallenge,
		env.ADMIN_API_TOKEN,
	);
	if (!expectedChallenge) {
		return Response.json(
			{ error: "Challenge expired or invalid" },
			{ status: 400 },
		);
	}

	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	const stored = await getPasskeyById(db, body.credential.id);
	if (!stored) {
		return Response.json({ error: "Unknown credential" }, { status: 400 });
	}

	const { rpID, origin } = getRpInfo(req);
	let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
	try {
		verification = await verifyAuthenticationResponse({
			response: body.credential,
			expectedChallenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: {
				id: stored.id,
				publicKey: b64uToBuf(stored.publicKey),
				counter: stored.counter,
			},
			requireUserVerification: false,
		});
	} catch (e) {
		return Response.json(
			{ error: "Verification failed", detail: String(e) },
			{ status: 400 },
		);
	}

	if (!verification.verified || !verification.authenticationInfo) {
		return Response.json({ error: "Verification failed" }, { status: 400 });
	}

	await updatePasskeyCounter(
		db,
		stored.id,
		verification.authenticationInfo.newCounter,
	);

	const sessionValue = await createSessionValue(env.ADMIN_API_TOKEN);
	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			"Content-Type": "application/json",
			"Set-Cookie": makeSetCookieHeader(sessionValue, req),
		},
	});
}

export async function handleLogout(
	req: IRequest,
	_env: Env,
): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: {
			"Content-Type": "application/json",
			"Set-Cookie": makeClearCookieHeader(req),
		},
	});
}
