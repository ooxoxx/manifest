#!/usr/bin/env bash
# .claude/hooks/post-edit-lint.sh
# 在 Write/Edit 后自动运行 lint 和 type check
# 错误会传递给 Claude Code 以便自动修复

set -o pipefail

# 读取 stdin JSON，提取 file_path
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 判断文件类型并运行相应检查
if [[ "$FILE_PATH" == *"/backend/"* ]] && [[ "$FILE_PATH" == *.py ]]; then
  echo "🔍 Running backend lint (mypy + ruff)..."
  if ! docker compose exec -T backend bash scripts/lint.sh 2>&1; then
    echo "❌ Backend lint failed" >&2
    exit 2  # 阻塞操作，错误传递给 Claude Code
  fi
  echo "✅ Backend lint passed"

elif [[ "$FILE_PATH" == *"/frontend/"* ]] && [[ "$FILE_PATH" == *.ts* ]]; then
  echo "🔍 Running frontend lint (Biome)..."
  cd "$CLAUDE_PROJECT_DIR/frontend"

  # 运行 Biome lint
  if ! pnpm run lint 2>&1; then
    echo "❌ Frontend lint failed" >&2
    exit 2
  fi

  # 运行 TypeScript 类型检查
  echo "🔍 Running TypeScript type check..."
  if ! pnpm exec tsc --noEmit 2>&1; then
    echo "❌ TypeScript type check failed" >&2
    exit 2
  fi

  echo "✅ Frontend lint and type check passed"
fi

exit 0
