# アーキテクチャガイドライン

## 技術スタック

| レイヤー | 技術 | 変更禁止の理由 |
|----------|------|--------------|
| ランタイム | Cloudflare Workers | エッジ実行 |
| ルーター | itty-router v5 (`AutoRouter`) | Hono は使わない |
| DB | Turso (libSQL) | D1 は使わない |
| ORM | Drizzle ORM | libSQL 対応 |
| バリデーション | Zod v4 | |
| Lint | oxlint | Biome / ESLint は使わない |
| Format | dprint | Prettier / Biome は使わない |
| インフラ | Terraform | |

## ルーティング規約

ハンドラのシグネチャは必ず以下の形式にすること:

```ts
export async function handleXxx(req: IRequest, env: Env): Promise<Response>
```

`src/index.ts` にルートを集約し、ハンドラは `src/handlers/` 以下に分割する。

## DB アクセス規約

- **必ず `@libsql/client/web` を使う** (`@libsql/client` の Node.js 版は Workers 非対応)
- DB クライアントはハンドラ内で毎回生成する:
  ```ts
  const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
  ```
- クエリ関数は `src/repository/timeTable.ts` に集約し、ハンドラに直接 Drizzle を書かない

## シークレット管理

| シークレット | 管理方法 |
|------------|---------|
| Workers シークレット | Terraform (`terraform/secrets.tf`) で管理 |
| ローカル開発 | `.dev.vars` (git 管理外) |

新しいシークレットを追加するときは必ず以下の 3 箇所を更新する:
1. `src/types.ts` の `Env` インターフェース
2. `terraform/variables.tf` の variable 定義
3. `terraform/secrets.tf` の `local.worker_secrets`

## インフラ管理の方針

| 対象 | ツール |
|------|--------|
| Worker スクリプト本体 | `bun run deploy` (Wrangler) |
| Turso DB / トークン | Terraform |
| Cloudflare WAF ルール | Terraform |
| Workers シークレット | Terraform |

**初回デプロイの順序**: `bun run deploy` → `terraform apply` → `bun run db:push`

Workers シークレットはスクリプトが存在してから設定できるため、初回のみ Wrangler が先。

## `/admin` セキュリティ

- IP 制限は Cloudflare WAF カスタムルールで行う（コードで実装しない）
- 許可 IP は `terraform/terraform.tfvars` の `admin_allowed_ips` で管理
- エンドポイント認証は Bearer Token (`ADMIN_API_TOKEN`)

## コミット前チェック

コードを変更したら必ず以下を実行してからコミットする:

```bash
bunx tsc --noEmit   # 型エラーがないこと
bun run lint        # oxlint でエラーがないこと
```

## JST 時刻

Cloudflare Workers は UTC で動作する。JST 変換は `src/utils/time.ts` の `getJSTTime()` を使う。
直接 `new Date()` から時刻を取得してはいけない。
