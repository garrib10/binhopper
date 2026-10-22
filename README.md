# Binhopper

Find the records you want in shops near you. Search an album, set your ZIP and a
10/25/50/100-mile radius, see which local shops have it in stock, then keep a wishlist
and track your collection.

**Stack:** React + TypeScript (Vite) · Python + FastAPI · MySQL 8 · pytest, Vitest, Playwright

## What's here

| Folder | Contents |
| --- | --- |
| `frontend/` | React app: theme tokens (light + dark), Nearby stock screen, tests |
| `backend/` | FastAPI app: data model, nearby-stock endpoint, radius + freshness logic, tests |
| `design/` | Mockups for every screen (mobile, desktop, dark mode) and how to read them |
| `docs/` | `SPEC.md`: MVP scope, feature rules, data model, API, acceptance criteria |

## Getting started

You need Python 3.12+, Node 20+, and Docker (for MySQL).

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env
alembic revision --autogenerate -m "initial tables"  # first time only
alembic upgrade head
python -m scripts.seed_sample
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs to try the API, e.g. `GET /api/albums/1/stock?zip=10011&radius=25`.

```bash
# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Tests

```bash
cd backend && pytest                    # unit + API tests (in-memory SQLite)
cd frontend && npm test                 # component tests
cd frontend && npx playwright install chromium && npm run e2e   # browser tests, phone + desktop
```

Tests reference the acceptance criteria in `docs/SPEC.md` by id (AC-01, AC-02, …).

## Branches and releases

Work flows **develop → staging → main**. Feature branches merge into `develop`; releases are
promoted with the Promote workflow. Details in [`docs/BRANCHING.md`](docs/BRANCHING.md).

## Status

Early v1. Built so far: data model, nearby-stock API (radius, freshness, empty state),
theme tokens with light/dark/system modes, and the Nearby stock screen.
Sample data in `backend/scripts/seed_sample.py` is fictional.
