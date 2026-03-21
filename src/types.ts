export interface Env {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN: string;
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	ALEXA_APP_ID: string;
	ADMIN_API_TOKEN: string;
	// Comma-separated list of allowed IPs for /admin routes. Empty = no restriction.
	ADMIN_ALLOWED_IPS: string;
}
