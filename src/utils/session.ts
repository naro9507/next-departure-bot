const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function bufToB64u(buf: Uint8Array): string {
	return btoa(String.fromCharCode(...buf))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

function b64uToBuf(b64u: string): Uint8Array {
	const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
	const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + pad;
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function importKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

export async function createSessionValue(secret: string): Promise<string> {
	const ts = Date.now();
	const key = await importKey(secret);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(String(ts)),
	);
	return `${ts}.${bufToB64u(new Uint8Array(sig))}`;
}

export async function verifySessionValue(
	value: string,
	secret: string,
): Promise<boolean> {
	const dot = value.indexOf(".");
	if (dot === -1) return false;
	const tsStr = value.slice(0, dot);
	const sigB64u = value.slice(dot + 1);
	const ts = parseInt(tsStr, 10);
	if (isNaN(ts) || Date.now() - ts > SESSION_TTL_MS) return false;
	const key = await importKey(secret);
	try {
		return await crypto.subtle.verify(
			"HMAC",
			key,
			b64uToBuf(sigB64u),
			new TextEncoder().encode(tsStr),
		);
	} catch {
		return false;
	}
}

export function getSessionCookie(req: Request): string | null {
	const header = req.headers.get("Cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const eqIdx = part.indexOf("=");
		if (eqIdx === -1) continue;
		const key = part.slice(0, eqIdx).trim();
		if (key === SESSION_COOKIE) return part.slice(eqIdx + 1).trim();
	}
	return null;
}

export function makeSetCookieHeader(value: string, req: Request): string {
	const secure = new URL(req.url).protocol === "https:";
	const secureFlag = secure ? "; Secure" : "";
	return `${SESSION_COOKIE}=${value}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function makeClearCookieHeader(req: Request): string {
	const secure = new URL(req.url).protocol === "https:";
	const secureFlag = secure ? "; Secure" : "";
	return `${SESSION_COOKIE}=; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=0`;
}
