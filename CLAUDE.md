# CLAUDE.md

## プロジェクト概要

LINE・Alexa からバス発車時刻を問い合わせるボット。Cloudflare Workers 上で動作し、Turso (libSQL) にバス停・時刻表データを保存する。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Cloudflare Workers |
| ルーター | itty-router v5 (`AutoRouter`) |
| DB | Turso (libSQL) |
| ORM | Drizzle ORM |
| バリデーション | Zod v4 |
| Lint | oxlint (`bun run lint`) |
| Format | dprint (`bun run format`) |
| インフラ | Terraform (`terraform/`) |

## ディレクトリ構成

```
src/
├── index.ts               # itty-router ルーティング定義
├── types.ts               # Env インターフェース (Workers シークレット)
├── db/
│   ├── schema.ts          # Drizzle スキーマ (bus_stops, timetable)
│   └── client.ts          # @libsql/client/web ファクトリ
├── utils/
│   └── time.ts            # JST 時刻取得・フォーマット
├── repository/
│   └── timeTable.ts       # Drizzle を使ったクエリ関数
└── handlers/
    ├── search.ts          # GET /search
    ├── admin.ts           # /admin/api/* REST API
    ├── adminPage.ts       # GET /admin (Alpine.js HTML)
    ├── line.ts            # POST /line (LINE Webhook)
    └── alexa.ts           # POST /alexa (Alexa スキル)
terraform/
├── providers.tf           # cloudflare ~>5.0, turso-dev/turso ~>0.1
├── variables.tf
├── turso.tf               # Turso DB + トークン
├── waf.tf                 # /admin の IP 制限 WAF ルール
├── secrets.tf             # Workers シークレット
└── outputs.tf
```

## 開発コマンド

```bash
bun run dev         # ローカル開発 (wrangler dev)
bun run deploy      # デプロイ
bun run lint        # oxlint
bun run format      # dprint
bun run db:push     # スキーマを Turso に直接適用
bun run db:generate # マイグレーションファイル生成
```

## ローカル開発の環境変数

`.dev.vars` ファイルに以下を設定する:

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
ALEXA_APP_ID=...
ADMIN_API_TOKEN=...
```

## DB スキーマ

```
bus_stops    id, name, created_at
timetable    id, bus_stop_id, day_type(weekday|saturday|holiday), hour, minute, created_at
```

- `hour` は 0〜30 (終電が翌日にまたぐ場合に 24 以上を使用)
- `day_type` は JST の曜日で自動判定 (日曜 → holiday)

## コーディングルール

- ハンドラ関数のシグネチャは `(req: IRequest, env: Env) => Promise<Response>`
- DB クライアントはハンドラ内で毎回 `createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN)` で生成
- `@libsql/client/web` を使用すること (Node.js 版は Workers 非対応)
- 新しいシークレットを追加する場合は `src/types.ts` の `Env` と `terraform/variables.tf` と `terraform/secrets.tf` の両方を更新する

## インフラ管理

Worker スクリプトのデプロイは Wrangler、それ以外 (Turso・WAF・シークレット) は Terraform で管理する。

初回セットアップの順序:
1. `bun run deploy` — Worker スクリプトを先に作成
2. `terraform apply` — Turso DB・WAF・シークレットを適用
3. `bun run db:push` — スキーマを Turso に適用

## WAF

`/admin` および `/admin/api/*` は Cloudflare WAF カスタムルールで許可 IP 以外をブロックする。
許可 IP は `terraform/terraform.tfvars` の `admin_allowed_ips` で管理。
