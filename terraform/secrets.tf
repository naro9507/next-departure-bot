# Workers シークレット
# NOTE: Worker スクリプト本体は wrangler deploy で別途デプロイする。
#       シークレットはスクリプトが存在してから適用する必要があるため、
#       初回は `wrangler deploy` → `terraform apply` の順で実行すること。

locals {
  worker_secrets = {
    TURSO_DATABASE_URL        = turso_database.main.url
    TURSO_AUTH_TOKEN          = turso_database_token.worker.jwt
    LINE_CHANNEL_SECRET       = var.line_channel_secret
    LINE_CHANNEL_ACCESS_TOKEN = var.line_channel_access_token
    ALEXA_APP_ID              = var.alexa_app_id
    ADMIN_API_TOKEN           = var.admin_api_token
  }
}

resource "cloudflare_workers_secret" "secrets" {
  for_each = local.worker_secrets

  account_id  = var.cloudflare_account_id
  script_name = var.worker_name
  name        = each.key
  text        = each.value
}
