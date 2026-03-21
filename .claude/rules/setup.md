# セットアップ

## 必要なアカウント・ツール

- [Cloudflare](https://cloudflare.com) アカウント（Workers・WAF 用）
- [Turso](https://turso.tech) アカウント（DB 用）
- [Terraform](https://terraform.io) CLI
- [Bun](https://bun.sh) ランタイム

## 初回セットアップ手順

Workers シークレットはスクリプトが存在してから設定できるため、順番が重要。

```bash
# 1. 依存パッケージのインストール
bun install

# 2. Worker スクリプトを先にデプロイ（空の状態でよい）
bun run deploy

# 3. Terraform でインフラを構築（Turso DB・WAF・シークレット）
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# terraform.tfvars を編集して各値を入力
cd terraform && terraform init && terraform apply

# 4. DB スキーマを Turso に適用
TURSO_DATABASE_URL=$(terraform output -raw turso_database_url) \
TURSO_AUTH_TOKEN=$(terraform output -raw turso_auth_token) \
bun run db:push
```

## ローカル開発の環境変数

`.dev.vars` を作成（git 管理外）:

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
ALEXA_APP_ID=...
ADMIN_API_TOKEN=your-strong-random-token
```

## シークレット管理の方針

| 用途 | 管理方法 |
|------|---------|
| 本番環境 | Terraform (`terraform/secrets.tf`) |
| ローカル開発 | `.dev.vars`（git 管理外） |

新しいシークレットを追加する場合は必ず以下の 3 箇所を同時に更新する:
1. `src/types.ts` の `Env` インターフェース
2. `terraform/variables.tf` の `variable` 定義
3. `terraform/secrets.tf` の `local.worker_secrets`

## インフラ管理の役割分担

| 対象 | ツール | コマンド |
|------|--------|---------|
| Worker スクリプト | Wrangler | `bun run deploy` |
| Turso DB + トークン | Terraform | `terraform apply` |
| Cloudflare WAF | Terraform | `terraform apply` |
| Workers シークレット | Terraform | `terraform apply` |

## WAF 設定

`/admin` および `/admin/api/*` へのアクセスは Cloudflare WAF カスタムルールで許可 IP 以外をブロックする。
許可 IP の変更は `terraform/terraform.tfvars` の `admin_allowed_ips` を編集して `terraform apply`。
**コード側で IP 制限を実装しない**（WAF に任せる）。
