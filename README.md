# next-departure-bot

LINE・Alexa に話しかけると次のバス発車時刻を教えてくれるボット。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Cloudflare Workers |
| ルーター | itty-router v5 |
| DB | Turso (libSQL) |
| ORM | Drizzle ORM |
| バリデーション | Zod |
| Lint | oxlint |
| Format | dprint |
| インフラ管理 | Terraform |

## 機能

- **LINE Bot**: バス停番号を送ると次の発車時刻を返信
- **Alexa スキル**: 「次のバスは？」で音声案内
- **管理画面** (`/admin`): バス停・時刻表をブラウザから編集
- 平日 / 土曜 / 休日で時刻表を自動切り替え（JST 基準）
- Cloudflare WAF による `/admin` の IP 制限

## エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/search?busStopId=1` | 次の発車時刻を JSON で取得 |
| `POST` | `/line` | LINE Webhook |
| `POST` | `/alexa` | Alexa スキル |
| `GET` | `/admin` | 管理画面 (IP 制限あり) |
| `*` | `/admin/api/*` | 管理 REST API (Bearer 認証) |

## セットアップ

### 1. 依存パッケージのインストール

```bash
bun install
```

### 2. Terraform でインフラを構築

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# terraform.tfvars を編集して各値を入力

cd terraform
terraform init
terraform apply
```

Turso DB・Cloudflare WAF ルール・Workers シークレットがまとめて作成されます。

### 3. Worker をデプロイ

```bash
bun run deploy
```

> **初回のみ順番に注意**: Workers シークレットはスクリプトが存在してから設定できます。
> 初回は `bun run deploy` → `terraform apply` の順で実行してください。

### 4. DB スキーマを適用

```bash
TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> bun run db:push
```

`terraform output -raw turso_database_url` と `terraform output -raw turso_auth_token` で値を取得できます。

## ローカル開発

```bash
# シークレットを .dev.vars に設定
cp .dev.vars.example .dev.vars  # 存在しない場合は手動で作成

bun run dev
```

`.dev.vars` の形式:

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
ALEXA_APP_ID=...
ADMIN_API_TOKEN=your-token
```

## コマンド一覧

```bash
bun run dev          # ローカル開発サーバー起動
bun run deploy       # Cloudflare Workers にデプロイ
bun run lint         # oxlint でコードチェック
bun run format       # dprint でフォーマット
bun run db:generate  # Drizzle マイグレーションファイル生成
bun run db:push      # DB にスキーマを直接適用
bun run cf-typegen   # Cloudflare バインディング型を生成
```

## LINE Bot のセットアップ

1. [LINE Developers Console](https://developers.line.biz/) でチャンネル作成
2. Messaging API を有効化
3. Webhook URL に `https://<your-worker>.workers.dev/line` を設定
4. Channel Secret と Channel Access Token を `terraform.tfvars` に記入して `terraform apply`

## Alexa スキルのセットアップ

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) でスキル作成
2. エンドポイントに `https://<your-worker>.workers.dev/alexa` を設定
3. `GetNextBusIntent` を作成し、スロット `BusStop` (数値) を定義
4. スキル ID を `terraform.tfvars` の `alexa_app_id` に記入して `terraform apply`
