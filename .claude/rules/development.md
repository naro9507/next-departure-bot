# 開発ワークフロー

## コマンド一覧

```bash
bun run dev          # ローカル開発サーバー起動 (wrangler dev)
bun run deploy       # Cloudflare Workers にデプロイ
bun run lint         # oxlint でコードチェック
bun run format       # dprint でフォーマット
bun run db:generate  # Drizzle マイグレーションファイル生成
bun run db:push      # スキーマを Turso に直接適用
bun run cf-typegen   # Cloudflare バインディング型を生成
```

## コミット前に必ず実行する

```bash
bunx tsc --noEmit   # 型エラーがゼロであること
bun run lint        # oxlint の警告・エラーがゼロであること
```

どちらかが失敗したままコミットしない。

## ブランチ運用

- 機能開発: `feature/<name>`
- バグ修正: `fix/<name>`
- ドキュメント: `docs/<name>`
- PR は日本語で作成する（`/pr` スラッシュコマンドを使う）

## スラッシュコマンド

| コマンド | 説明 |
|---------|------|
| `/update-rules` | セッションの変更を architecture.md と CLAUDE.md に反映 |
| `/pr` | 日本語で PR を作成 |

## LINE / Alexa のローカルテスト

- **LINE**: ngrok でトンネリングして LINE Developers Console の Webhook URL に設定
- **Alexa**: Alexa Developer Console のシミュレータを使用

## Turso データの確認

```bash
turso db shell <db-name>
# または
terraform output -raw turso_database_url | xargs turso db shell
```
