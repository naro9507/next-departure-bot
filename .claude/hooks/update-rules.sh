#!/bin/bash
# Stop hook: セッション終了時にルールドキュメントの更新を Claude に促す

input=$(cat)

# 再帰防止
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')
if [[ "$stop_hook_active" == "true" ]]; then
  exit 0
fi

# git リポジトリでなければスキップ
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# このプロジェクトのディレクトリ内かチェック
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
repo_root=$(git -C "$project_dir" rev-parse --show-toplevel 2>/dev/null)
script_repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)

if [[ "$repo_root" != "$script_repo" ]]; then
  exit 0
fi

# 直近のコミットでルール対象ファイルに変更があるか確認
# (src/ terraform/ の変更 = アーキテクチャに影響する可能性あり)
changed=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -E '^(src/|terraform/)' || true)

if [[ -z "$changed" ]]; then
  exit 0
fi

echo "/update-rules を実行して、このセッションの変更をアーキテクチャルール (.claude/rules/architecture.md) と CLAUDE.md に反映してください。" >&2
exit 2
