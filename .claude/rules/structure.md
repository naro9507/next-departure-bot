# ディレクトリ構成

```
src/
├── index.ts               # ルーティング定義 (itty-router AutoRouter)
├── types.ts               # Env インターフェース (Workers シークレット一覧)
├── db/
│   ├── schema.ts          # Drizzle スキーマ定義 (bus_stops, timetable, passkey_credentials)
│   └── client.ts          # @libsql/client/web ファクトリ関数
├── utils/
│   ├── time.ts            # JST 時刻取得・フォーマットユーティリティ
│   └── session.ts         # HMAC-SHA256 署名付き HttpOnly Cookie ユーティリティ
├── repository/
│   ├── timeTable.ts       # DB クエリ関数 (次発時刻・CRUD)
│   └── passkey.ts         # パスキークレデンシャル CRUD
└── handlers/
    ├── search.ts          # GET /search?busStopId=N
    ├── admin.ts           # /admin/api/* の REST API ハンドラ (Cookie セッション認証)
    ├── adminPage.ts       # GET /admin の Alpine.js HTML (パスキー UI)
    ├── auth.ts            # /admin/api/auth/* (WebAuthn 登録・認証・ログアウト)
    ├── line.ts            # POST /line (LINE Webhook)
    └── alexa.ts           # POST /alexa (Alexa スキル)

terraform/
├── providers.tf           # cloudflare ~>5.0, turso-dev/turso ~>0.1
├── variables.tf           # 全入力変数の定義
├── turso.tf               # Turso DB リソース + Worker 用トークン
├── waf.tf                 # /admin の IP 制限 WAF カスタムルール
├── secrets.tf             # Workers シークレット (for_each)
└── outputs.tf             # DB URL / token / WAF ruleset ID

.claude/
├── rules/                 # Claude が自動で読み込むルールファイル群
├── commands/              # スラッシュコマンド定義
├── hooks/                 # Stop hook スクリプト
└── settings.json          # プロジェクトレベル hook 登録

.github/
└── pull_request_template.md  # PR テンプレート (日本語)
```

## 新しいエンドポイントを追加するとき

1. `src/handlers/` に新しいハンドラファイルを作成
2. `src/index.ts` にルートを追加
3. 新しいシークレットが必要なら `src/types.ts` / `terraform/variables.tf` / `terraform/secrets.tf` を更新

## DB スキーマ

```
bus_stops            id, name, created_at
timetable            id, bus_stop_id, day_type(weekday|saturday|holiday), hour, minute, created_at
passkey_credentials  id(credential_id), public_key, counter, created_at
```

- `hour` は 0〜30（終電が翌日にまたぐ場合は 24 以上）
- `day_type` は JST の曜日で自動判定（日曜 → holiday）
- `passkey_credentials.public_key` は COSE 公開鍵を base64url エンコードして保存
