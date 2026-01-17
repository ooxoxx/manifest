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

## Important Notes

- **CRITICAL: Always use `docker compose watch` for development and debugging**
  - DO NOT separately run `pnpm dev` or backend services outside Docker for local development
  - The entire stack (frontend, backend, database, redis) should run together via `docker compose watch`
  - This ensures consistent environment, proper service dependencies, and automatic hot reload
  - Only run services separately when explicitly debugging service-specific issues
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
