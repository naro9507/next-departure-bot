# CLAUDE.md

LINE・Alexa からバス発車時刻を問い合わせるボット。Cloudflare Workers + Turso (libSQL) で動作する。

## ルール一覧

詳細は `.claude/rules/` を参照:

| ファイル | 内容 |
|---------|------|
| `architecture.md` | 技術スタック・コーディング規約・禁止事項 |
| `structure.md` | ディレクトリ構成と各ファイルの役割 |
| `setup.md` | 初回セットアップ・環境変数・インフラ手順 |
| `development.md` | 開発コマンド・ワークフロー・コミット前チェック |

## エンドポイント早見表

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/search?busStopId=1` | 次の発車時刻 (JSON) |
| `POST` | `/line` | LINE Webhook |
| `POST` | `/alexa` | Alexa スキル |
| `GET` | `/admin` | 管理画面 (IP 制限あり) |
| `*` | `/admin/api/*` | 管理 REST API (Bearer 認証) |
