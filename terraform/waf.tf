# Cloudflare WAF カスタムルール: /admin を許可 IP 以外からブロック
resource "cloudflare_ruleset" "admin_ip_restriction" {
  zone_id     = var.cloudflare_zone_id
  name        = "Admin IP Restriction"
  description = "Block /admin access from non-allowed IPs"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action      = "block"
    enabled     = true
    description = "Restrict /admin to allowed IPs"

    # http.request.uri.path contains "/admin"
    # AND ip.src not in { allowed IPs }
    expression = format(
      "(http.request.uri.path contains \"/admin\" and not ip.src in {%s})",
      join(" ", [for ip in var.admin_allowed_ips : ip])
    )
  }
}
