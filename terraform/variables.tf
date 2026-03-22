# ── Cloudflare ────────────────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API token (needs Workers, WAF edit permissions)"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the target domain"
  type        = string
}

variable "worker_name" {
  description = "Cloudflare Workers script name (must match wrangler.jsonc name)"
  type        = string
  default     = "next-departure-bot"
}

# ── WAF ───────────────────────────────────────────────────────────────────────

variable "admin_allowed_ips" {
  description = "List of IP addresses allowed to access /admin (e.g. [\"203.0.113.1\"])"
  type        = list(string)
}

# ── Turso ─────────────────────────────────────────────────────────────────────

variable "turso_api_token" {
  description = "Turso platform API token (create at https://turso.tech/app)"
  type        = string
  sensitive   = true
}

variable "turso_organization" {
  description = "Turso organization slug"
  type        = string
}

variable "turso_group" {
  description = "Turso database group name"
  type        = string
  default     = "default"
}

# ── App secrets ───────────────────────────────────────────────────────────────

variable "line_channel_secret" {
  description = "LINE channel secret"
  type        = string
  sensitive   = true
}

variable "line_channel_access_token" {
  description = "LINE channel access token"
  type        = string
  sensitive   = true
}

variable "alexa_app_id" {
  description = "Alexa skill application ID"
  type        = string
  default     = ""
}

variable "admin_api_token" {
  description = "Bearer token for admin API authentication"
  type        = string
  sensitive   = true
}
