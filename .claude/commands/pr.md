現在のブランチの変更内容をもとに、日本語で Pull Request を作成してください。

## 手順

1. **変更内容を把握する**（以下を並行して実行）
   - `git log --oneline main..HEAD` でコミット一覧を確認
   - `git diff main..HEAD --stat` で変更ファイルを確認
   - `git diff main..HEAD` で差分の詳細を確認

2. **PR タイトルを決める**
   - 日本語で 40 文字以内
   - 変更の本質を一言で表す
   - 例: `管理画面を Alpine.js の Web UI に変更`、`Terraform でインフラ管理を追加`

3. **PR 本文を作成する**
   `.github/pull_request_template.md` のテンプレートに従い、以下を日本語で記述する:
   - **変更内容**: 何をしたか（箇条書き）
   - **変更の種類**: 該当するものをチェック
   - **動作確認**: テスト・確認した内容
   - **確認事項**: チェックリスト

4. **PR を作成する**
   ```bash
   gh pr create --title "<タイトル>" --body "<本文>"
   ```

## 注意

- タイトル・本文はすべて日本語で書く
- 技術用語（Terraform、Cloudflare Workers など）はそのまま英語でよい
- PR 作成後は URL を表示する
