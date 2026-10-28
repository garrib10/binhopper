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

## Catalog

See [catalog import and worker setup](docs/CATALOG.md) for the offline CC0 sample, monthly
dump imports, API freshness rules and the separate Railway worker service.

## Hosting

See [the deployment guide](docs/DEPLOY.md) for Railway/Vercel setup, environment variables,
first deployment, monitoring setup and rollback.

## Getting started

You need Python 3.12+, Node 24+, and Docker (for MySQL).

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
python -m scripts.seed_sample
uvicorn app.main:app --reload
```

**ZIP codes.** The sample data only knows ZIP 10011. To search from any US ZIP, load the
US Census Bureau's ZIP center points (ZCTA Gazetteer, public domain, about 34,000 rows).
Download and unzip the file yourself; the loader never goes online. Re-running it updates
rows in place.

```bash
# from backend/
curl -O https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
unzip 2026_Gaz_zcta_national.zip
python -m scripts.load_zip_codes 2026_Gaz_zcta_national.txt
```

The Census file covers ZIPs with street addresses. PO-box-only ZIPs (for example 06011) are
not in it and show "We don't have that ZIP yet."

Open http://localhost:8000/docs to try the API, e.g. `GET /api/albums/1/stock?zip=10011&radius=25`.

```bash
# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

**Signing in locally.** Create an account at http://localhost:5173/create-account. Locally no
email is sent (`EMAIL_BACKEND=log`): the confirmation or reset email, with its link, is printed
in the `uvicorn` terminal between `--- Email to …` lines. Open that link in the browser. Google
sign-in shows only if you add Google keys to `backend/.env` (see docs/DEPLOY.md › Sign-in).

## Tests

```bash
cd backend && pytest                    # unit + API tests (in-memory SQLite)
```

To run the same backend tests against MySQL, as CI's `integration` job does, create a separate
test database once (the tests roll back every change, but they can't share the dev database):

```bash
docker exec binhopper-mysql-1 mysql -uroot -pbinhopper-root \
  -e "CREATE DATABASE IF NOT EXISTS binhopper_test; GRANT ALL ON binhopper_test.* TO 'binhopper'@'%';"
cd backend
export TEST_DATABASE_URL=mysql+pymysql://binhopper:binhopper@127.0.0.1:3306/binhopper_test
DATABASE_URL=$TEST_DATABASE_URL alembic upgrade head
pytest
unset TEST_DATABASE_URL                 # back to SQLite
```

```bash
cd frontend && npm test                 # component tests
cd frontend && npx playwright install chromium && npm run e2e   # browser tests, phone + desktop
```

System tests run the built frontend against the real API and a seeded MySQL, with nothing
mocked (CI's `system` job). Set up their database once, then run them from `frontend/`:

```bash
docker exec binhopper-mysql-1 mysql -uroot -pbinhopper-root \
  -e "CREATE DATABASE IF NOT EXISTS binhopper_system; GRANT ALL ON binhopper_system.* TO 'binhopper'@'%';"
export DATABASE_URL=mysql+pymysql://binhopper:binhopper@127.0.0.1:3306/binhopper_system
cd backend
alembic upgrade head
python -m scripts.seed_sample
python -m scripts.load_zip_codes tests/fixtures/gazetteer_zcta_sample.txt
cd ../frontend
PYTHON=../backend/.venv/bin/python npm run e2e:system   # starts the API on :8010 and preview on :4173
unset DATABASE_URL
```

Tests reference the acceptance criteria in `docs/SPEC.md` by id (AC-01, AC-02, …).
[docs/TESTING.md](docs/TESTING.md) explains what each test level owns, the test data, mocking
rules, CI gates and the release checklist.

## Branches and releases

Work flows **develop → staging → main**. Feature branches merge into `develop`; releases are
promoted with the Promote workflow. Details in [`docs/BRANCHING.md`](docs/BRANCHING.md).

## Status

Early v1. Built so far: data model, nearby-stock API (radius, freshness, empty state),
theme tokens with light/dark/system modes, and the Nearby stock screen.
Sample data in `backend/scripts/seed_sample.py` is fictional.
