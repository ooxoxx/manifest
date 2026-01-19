# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Manifest is an AI Laboratory Sample Asset Management System - a full-stack web application for managing millions of AI training samples across distributed storage systems (MinIO, external drives, local disks).

## Tech Stack

- **Backend**: FastAPI + SQLModel + PostgreSQL + Redis
- **Frontend**: React 19 + TypeScript + Vite + TanStack Router/Query + Tailwind CSS + shadcn/ui
- **Package Management**: `uv` (Python), npm/pnpm (Node 24)
- **Testing**: pytest (backend), Playwright (frontend E2E)
- **Code Quality**: ruff + mypy (Python), Biome (TypeScript), pre-commit hooks

## Essential Commands

### Development

```bash
# Start entire stack with hot reload (preferred method)
docker compose watch

# URLs (use 127.0.0.1, not localhost)
# Frontend:        http://127.0.0.1:5173
# Backend API:     http://127.0.0.1:8000
# API Docs:        http://127.0.0.1:8000/docs
# Adminer (DB UI): http://127.0.0.1:8080
# Mailcatcher:     http://127.0.0.1:1080
# MinIO Console:  http://127.0.0.1:9001
# MinIO API:      http://127.0.0.1:9000
# MinIO 凭据:     minioadmin / minioadmin
```

### Backend Testing

```bash
# Full test suite with coverage
docker compose exec backend bash scripts/tests-start.sh

# Run specific test file
docker compose exec backend pytest tests/api/test_users.py -v

# Run single test
docker compose exec backend pytest tests/api/test_users.py::test_create_user -v

# Stop on first failure
docker compose exec backend bash scripts/tests-start.sh -x
```

### Frontend Testing

```bash
# Ensure backend is running first
npx playwright test                    # Run all E2E tests
npx playwright test --ui               # Interactive UI mode
npx playwright test tests/auth.spec.ts # Specific test file
```

### Code Quality

```bash
# Backend (from backend/)
bash scripts/lint.sh                   # Check with mypy, ruff
bash scripts/format.sh                 # Auto-fix formatting

# Frontend (from frontend/)
npm run lint                           # Biome check with --write

# All pre-commit hooks (from root)
uv run prek run --all-files
```

### Database Migrations

```bash
docker compose exec backend bash
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

### Generate Frontend API Client

```bash
./scripts/generate-client.sh
# Or manually from frontend/: npm run generate-client
```

## Architecture

### Backend Structure

- `app/api/routes/` - API endpoints organized by domain (samples, datasets, tags, etc.)
- `app/models.py` - SQLModel ORM definitions for all entities
- `app/crud.py` - Database CRUD operations
- `app/services/` - Business logic services
- `app/core/config.py` - Settings loaded from environment

### Frontend Structure

- `src/routes/` - TanStack Router page components
- `src/components/` - React components organized by feature
- `src/client/` - Auto-generated OpenAPI client (regenerate after API changes)

### Key Data Models

- **Sample** - AI training sample with file metadata, hash, MIME type
- **Tag** - Hierarchical labels (parent_id, level, full_path)
- **Dataset** - Logical collection of samples with filtering criteria
- **MinIOInstance** - Storage configuration for S3-compatible storage
- **WatchedPath** - Monitored directories for auto-ingestion

## Multi-Worktree Development

### Port Configuration

When working with multiple git worktrees, use different port variables to avoid conflicts:

| Service | Variable | Default | Worktree 2 (example) |
|---------|----------|---------|----------------------|
| Frontend | `FRONTEND_PORT` | 5173 | 5273 |
| Backend | `BACKEND_PORT` | 8000 | 8100 |
| Database | `DB_PORT` | 5432 | 5532 |
| Adminer | `ADMINER_PORT` | 8080 | 8180 |
| Mailcatcher Web | `MAILCATCHER_WEB_PORT` | 1080 | 1180 |
| Mailcatcher SMTP | `MAILCATCHER_SMTP_PORT` | 1025 | 1125 |
| Traefik HTTP | `TRAEFIK_HTTP_PORT` | 80 | 180 |
| Traefik Dashboard | `TRAEFIK_DASHBOARD_PORT` | 8090 | 8190 |
| Playwright Reporter | `PLAYWRIGHT_REPORTER_PORT` | 9323 | 9423 |

### Setting Up a New Worktree

1. Create worktree:
   ```bash
   git worktree add ../<branch-name> -b <branch-name>
   cd ../<branch-name>
   ```

2. Create `.env` with unique ports (copy from main, adjust ports):
   ```bash
   cp ../<main-worktree>/.env .env
   # Edit .env and set unique port variables:
   # FRONTEND_PORT=5273
   # BACKEND_PORT=8100
   # DB_PORT=5532
   # ... etc
   ```

3. Start services:
   ```bash
   docker compose watch
   ```

### Running Playwright Tests

Use environment variable to target correct frontend:

```bash
# Default (port 5173)
npx playwright test

# Different worktree
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5273 npx playwright test

# With UI mode
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5273 npx playwright test --ui
```

## Testing Guidelines (Frontend)

**Context**: Run all commands in `frontend/`. Target: `http://127.0.0.1:5173` (or your worktree's port).

- **Workflow Strategy**:
  - **Drafting/Debugging**: Use `npx playwright test --ui` for interactive mode
  - **Final Verification**: Use `npx playwright test` (headless)

- **Multi-worktree Testing**:
  ```bash
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> npx playwright test
  ```

- **Coding Rules**:
  1.  **Locators**: Priority: `getByRole` > `getByText` > `getByTestId`. **FORBIDDEN**: Fragile XPath or generic CSS (e.g., `div > div:nth-child(2)`).
  2.  **Waits**: **FORBIDDEN**: `page.waitForTimeout()`. Use auto-retrying assertions (e.g., `await expect(locator).toBeVisible()`).
  3.  **Isolation**: Use `data-testid` for unstable elements. Clean up test data after execution.

## Important Notes

- **CRITICAL: Always use `docker compose watch` for development and debugging**
  - The entire stack (frontend, backend, database, redis) should run together via `docker compose watch`
  - use `docker compose logs <container>` to review debugging logs after watch started
  - once started, watch process can sync all file changes to docker containers, and start rebuild on demand
  - This ensures consistent environment, proper service dependencies, and automatic hot reload
- **CRITICAL: Always use `uv` for Python commands outside Docker**
  - Use `uv run <command>` for all Python-related commands when running locally (not in Docker)
  - Examples: `uv run pytest`, `uv run ruff`, `uv run mypy`, `uv run prek`
  - This ensures you're using the project's configured Python environment with correct dependencies
  - DO NOT use bare `python`, `pytest`, or `pip` commands directly
- Always use `127.0.0.1` instead of `localhost` in terminal commands
- Node 24 is required (use `fnm use` or `nvm use` with `.nvmrc`)
- Run `alembic upgrade head` after pulling changes with migrations
- Regenerate frontend client after backend API changes
- Pre-commit hooks auto-run on commit; install with `uv run prek install -f`
- Coverage reports are generated at `backend/htmlcov/index.html`
- See `docs/PROJECT.md` for detailed PRD, data models, and user stories
- use pnpm over npm where possible for frontend package management
- 开发过程中，你**不需要**处理openapi相关的内容，比如执行 `scripts/generate-client.sh`
- **MinIO 测试实例**
  - 仅在 `docker-compose.override.yml` 中配置，用于本地开发和 E2E 测试
  - 预置 `test-bucket`，包含示例图片和 VOC 标注文件（部分有标注，部分无）
  - E2E 测试中添加 MinIO 实例时使用：
    - Endpoint: `minio:9000`（容器内）或 `127.0.0.1:9000`（本机）
    - Access Key: `minioadmin`
    - Secret Key: `minioadmin`
    - Secure: `false`
- 前端调用后端API必须使用openapi客户端，而不是fetch某个url。每当你更新了后端api，就应该运行`scripts/generate-client.sh`重新生成前端openapi客户端，以保证协议的一致性。这个脚本需要先使用`backend/.venv/bin/activate`激活python开发环境才能运行，否则会有环境错误。