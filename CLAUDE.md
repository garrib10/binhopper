# Binhopper

Find vinyl records in shops near you (ZIP + 10/25/50/100 mi radius), keep a wishlist,
and track your collection. React web app (mobile + desktop) + Python FastAPI + MySQL 8.

## Where things are

- `docs/SPEC.md`: what to build. Feature rules, data model, API endpoints, acceptance
  criteria (AC-01 to AC-21). Follow it; if code and spec disagree, ask before changing either.
- `docs/TESTING.md`: test levels, AC-01 to AC-21 → tests map, test data, mocking rules, CI gates.
- `design/mockups/*.dc.html`: the visual target for every screen. `design/README.md` explains
  the file format and maps each file to its spec section.
- `frontend/src/styles/tokens.css`: all colors, fonts, radii and spacing, light + dark.
- `backend/app/`: FastAPI app. `geo.py` (distance/radius math), `freshness.py` (stock
  freshness rules), `models.py` (tables), `routers/` (endpoints).

## Rules

- **Use tokens, never hard-coded colors.** Every color is a `var(--color-…)` from tokens.css,
  so light and dark mode both work. Mockup hex values map to tokens by name and role.
- **Match the mockups:** condensed uppercase Archivo headings, Inter body text, 44 px minimum
  touch targets, 4.5:1 text contrast. Build reusable components (store card, radius picker,
  album tile, segmented control) rather than copying inline styles.
- **Private by default:** profile, collection and wishlist start as "Only me".
- **Real buttons and links:** `<button>`, `<a href>`, `<label>` + `<input>`; no click handlers on divs.
- **Tests come with features.** Each feature adds tests for its acceptance criteria and names
  the AC id in the test (e.g. `# AC-06`). API rules get pytest tests; UI behavior gets Vitest
  component tests; core flows get a Playwright test at 390 px and 1440 px.
- **Mock outside services** (Discogs, Places) in tests. Never call real APIs from tests.
- **Keep secrets out of the frontend.** API keys live only in `backend/.env`.

## Branches

develop → staging → main (see `docs/BRANCHING.md`). Start work from `develop` on a
`feature/…`, `fix/…` or `chore/…` branch and open the PR into `develop`. Never commit directly
to `staging` or `main`; urgent production fixes use `hotfix/…` from `main`. Fill in the PR
template's testing and security checklist.

## Commands

```bash
# Database
docker compose up -d                      # MySQL 8 on localhost:3306

# Backend (from backend/)
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head                     # creates/updates tables from migrations/versions/
# Changed a model? alembic revision --autogenerate -m "what changed", review it, commit it
python -m scripts.seed_sample            # fictional sample data
python -m scripts.seed_test_data         # test cases: radius edges, every freshness tier (not for demos)
# All US ZIPs: download + unzip the Census ZCTA Gazetteer file first (see README.md), then
python -m scripts.load_zip_codes 2026_Gaz_zcta_national.txt   # safe to re-run
uvicorn app.main:app --reload            # API on :8000, try it at /docs
pytest                                   # backend tests (SQLite, no MySQL needed)
# Same tests on MySQL (CI "integration" job); test DB setup in README.md › Tests
TEST_DATABASE_URL=mysql+pymysql://binhopper:binhopper@127.0.0.1:3306/binhopper_test pytest

# Frontend (from frontend/)
npm install
npm run dev                              # http://localhost:5173 (proxies /api to :8000)
npm test                                 # Vitest
npx playwright install chromium          # first time only
npm run e2e                              # Playwright, API mocked (Chromium)
npm run e2e:all                          # same, plus WebKit (Safari) and Firefox; first: npx playwright install webkit firefox
npm run e2e:system                       # Playwright, real API + seeded MySQL (setup: README.md › Tests)
npm run build                            # type-check + production build
```

## Build order (from SPEC.md)

Catalog import + search → album page → nearby stock → wishlist → collection →
account settings → Discogs import. Nearby stock's backend logic and a first screen exist already.
