# インフラ仕様

## 構成概要

```
Cloudflare Workers  ← スクリプト: Wrangler でデプロイ
  └── Workers シークレット  ← Terraform で管理
Cloudflare WAF      ← Terraform で管理
Turso (libSQL)      ← Terraform で管理
```

---

## Terraform リソース一覧

### `terraform/turso.tf`

| リソース | 説明 |
|---------|------|
| `turso_database.main` | Turso DB 本体（名前: `next-departure-bot`） |
| `turso_database_token.worker` | Worker 用の認証トークン（有効期限: never, 権限: full-access） |

### `terraform/waf.tf`

| リソース | 説明 |
|---------|------|
| `cloudflare_ruleset.admin_ip_restriction` | `/admin` を許可 IP 以外からブロックする WAF カスタムルール |

WAF ルールの式:
```
(http.request.uri.path contains "/admin" and not ip.src in {<ip1> <ip2> ...})
```

許可 IP は `terraform.tfvars` の `admin_allowed_ips` リストで管理する。

### `terraform/secrets.tf`

`for_each` で以下のシークレットを一括作成:

| シークレット名 | 値のソース |
|--------------|----------|
| `TURSO_DATABASE_URL` | `turso_database.main.url` |
| `TURSO_AUTH_TOKEN` | `turso_database_token.worker.jwt` |
| `LINE_CHANNEL_SECRET` | `var.line_channel_secret` |
| `LINE_CHANNEL_ACCESS_TOKEN` | `var.line_channel_access_token` |
| `ALEXA_APP_ID` | `var.alexa_app_id` |
| `ADMIN_API_TOKEN` | `var.admin_api_token` |

**注意**: Workers シークレットはスクリプトが存在してから設定できるため、初回は `bun run deploy` 後に `terraform apply` を実行する。

---

## Terraform 変数一覧

`terraform/terraform.tfvars` に設定する（git 管理外）。

| 変数名 | 説明 |
|--------|------|
| `cloudflare_api_token` | Cloudflare API トークン（Workers・WAF 編集権限が必要） |
| `cloudflare_account_id` | Cloudflare アカウント ID |
| `cloudflare_zone_id` | 対象ドメインのゾーン ID |
| `worker_name` | Workers スクリプト名（`wrangler.jsonc` の `name` と一致させる） |
| `admin_allowed_ips` | `/admin` への許可 IP リスト |
| `turso_api_token` | Turso プラットフォーム API トークン |
| `turso_organization` | Turso 組織スラッグ |
| `turso_group` | Turso グループ名（デフォルト: `default`） |
| `line_channel_secret` | LINE チャンネルシークレット |
| `line_channel_access_token` | LINE チャンネルアクセストークン |
| `alexa_app_id` | Alexa スキルアプリケーション ID |
| `admin_api_token` | 管理 API の Bearer トークン |

---

## デプロイフロー

### 初回

```bash
bun run deploy          # 1. Worker スクリプトを作成
terraform apply         # 2. Turso・WAF・シークレットを適用
bun run db:push         # 3. DB スキーマを適用
```

### 2 回目以降

```bash
# コード変更のみ
bun run deploy

# インフラ変更のみ（IP 追加・シークレット更新など）
terraform apply

# スキーマ変更
bun run db:push
```

---

## Outputs

```bash
terraform output -raw turso_database_url   # libsql://...
terraform output -raw turso_auth_token     # eyJ...
terraform output waf_ruleset_id            # xxxxxxxx
```
