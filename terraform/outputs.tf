output "turso_database_url" {
  description = "Turso database URL (libsql://...)"
  value       = turso_database.main.url
  sensitive   = true
}

output "turso_auth_token" {
  description = "Turso auth token for the worker"
  value       = turso_database_token.worker.jwt
  sensitive   = true
}

output "waf_ruleset_id" {
  description = "Cloudflare WAF ruleset ID"
  value       = cloudflare_ruleset.admin_ip_restriction.id
}
