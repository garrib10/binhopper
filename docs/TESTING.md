# Testing

Every feature ships with tests at the level its acceptance criteria name in
[SPEC.md › Acceptance criteria and test plan](SPEC.md#acceptance-criteria-and-test-plan), and
names the AC id in the test (`# AC-06` in Python, `// AC-06` in TypeScript). Outside services
are always mocked. This page says which level owns what, where test data comes from, and what
CI and a release check.

Some pieces arrive in open pull requests and are marked with their PR: MySQL integration (#94),
system tests (#95) and the test-data seed (#96).

## Test levels

| Level | Tool | Where | Owns | CI job |
| --- | --- | --- | --- | --- |
| Unit (backend) | pytest | `backend/tests/test_geo.py`, `test_freshness.py`, … | Pure rules: radius math, freshness, duplicate detection, ZIP parsing | `backend` |
| Unit (frontend) | Vitest + Testing Library | `frontend/src/**/*.test.ts(x)` | Component behavior: validation, error messages, state changes | `frontend` |
| API | pytest + FastAPI `TestClient` | `backend/tests/test_*_api.py` | Each endpoint's happy path, error codes, auth and privacy | `backend` |
| Integration | the same pytest suite on MySQL 8.4 | `TEST_DATABASE_URL` set (#94) | What SQLite hides: column precision, upserts, collation; migrations apply cleanly | `integration` (#94) |
| E2E (mocked API) | Playwright, 390 px + 1440 px | `frontend/e2e/` | UI flows with the API faked by `page.route`, plus axe accessibility checks | `e2e` |
| System | Playwright, real API + seeded MySQL | `frontend/e2e-system/` (#95) | The whole stack together, nothing mocked | `system` (#95) |
| Acceptance | all of the above | the table below | AC-01 to AC-16, each at the level SPEC.md names | all |

**What a feature owes:** pytest for every API rule; a Vitest test for each piece of UI behavior;
a Playwright test at 390 px and 1440 px for each core flow; the AC id in each of those tests.
If a rule depends on MySQL behavior (precision, upserts, JSON), make sure it runs in the
integration job, which happens automatically for anything using the `session` fixture.

## Acceptance criteria map

"Tests today" lists files that name the id. Open PRs are marked; rows without tests belong to
the feature issue that will add them.

| AC | Rule (short) | SPEC level | Tests today | Owner |
| --- | --- | --- | --- | --- |
| AC-01 | Only stores in radius, closest first per tier | Unit + API | `test_nearby_stock_api.py`; `e2e-system/nearby-stock.spec.ts` (#95); `test_seed_test_data.py` (#96) | done |
| AC-02 | Store exactly on the radius is included | Unit | `test_geo.py`, `test_nearby_stock_api.py`; `test_seed_test_data.py` (#96) | done |
| AC-03 | Empty radius shows nearest copy + wider radius | E2E | `e2e/nearby-stock.spec.ts`, `NearbyStockPage.test.tsx`, `test_nearby_stock_api.py`; `e2e-system/…` (#95) | done |
| AC-04 | Invalid or unknown ZIP: inline error, no request | Unit + E2E | `NearbyStockPage.test.tsx`, `test_nearby_stock_api.py`; `e2e-system/…` (#95) | done |
| AC-05 | 8-day-old unverified listing warns | Unit | `test_freshness.py`, `test_nearby_stock_api.py` | done |
| AC-06 | 2 missing reports in 24 h: flagged, sorts last | Unit + API | `test_freshness.py`, `test_nearby_stock_api.py` | done |
| AC-07 | Second report the same day: 429 + message | API | — | #37 |
| AC-08 | Heart twice adds then removes, survives reload | E2E | — | #39 |
| AC-09 | Duplicate pressing warns, "Add as 2nd copy" | Unit + E2E | seed data only (#96) | #41 |
| AC-10 | Hand-off purchase moves wishlist → collection | E2E | — | #40 |
| AC-11 | Discogs import skips existing releases | API | — | #44 |
| AC-12 | Search waits for 2+ characters and a pause | Unit | — | #33 |
| AC-13 | New account is private; others get 404 | API | — | #38, #42 |
| AC-14 | "Match system" follows device dark mode | E2E | `e2e/nearby-stock.spec.ts`, `theme.test.ts` | #42 (settings screen) |
| AC-15 | Account delete removes data and sign-in | API + E2E | — | #42 |
| AC-16 | Never more than 60 Discogs calls per 60 s | Integration | — | #32, #70 |

## Test data

| Data | Where | Used by |
| --- | --- | --- |
| Per-test rows | Built inside each pytest test on a fresh in-memory SQLite database (`backend/tests/conftest.py`) | Unit and API tests |
| Frozen clock | `NOW` in `backend/tests/helpers.py`, injected via the `get_now` override | Anything time-based (freshness, reports) |
| Fixture files | `backend/tests/fixtures/` (small Census ZIP files) | ZIP loader tests; the system run loads ZIPs 06010 and 10011 from here |
| Demo seed | `backend/scripts/seed_sample.py`: fictional NYC shops around 10011 | Local development; system tests (#95) |
| Test-data seed | `backend/scripts/seed_test_data.py` (#96), made-up 00xxx ZIPs | Integration and system tests that need every rule |
| Mocked API responses | Inline in each `frontend/e2e/*.spec.ts` via `page.route` | E2E (mocked) |

The test-data seed (#96) contains, by store name:

- `Edge 10/25/50/100 mi`: exactly on each radius from ZIP `00001`; `Past … mi`: 0.1 mi beyond
- `Tier verified`, `Tier current`, `Tier out of date`, `Tier reported missing`: one listing per freshness tier
- ZIP `00002`: every radius empty; ZIP `00000`: deliberately not loaded (404)
- "Test Album" with two pressings, and user `test-collector` who owns one (duplicate warning)

Load it with `python -m scripts.seed_test_data` after `alembic upgrade head`. Times are relative to
the moment it loads, and loading twice is a no-op.

## Mocking rules

- **Discogs and Places are always mocked** in automated tests. No test may call a real outside
  API, and CI has no keys for them.
- Backend: replace the client at its boundary (a fake client or `monkeypatch`), never by
  patching `httpx` globally. Rate-limit tests use a fake clock, not real waiting.
- Frontend unit tests: stub `fetch` with `vi.spyOn(globalThis, 'fetch')`.
- E2E (mocked): fake the API with `page.route`. The system tests mock nothing, so they must not
  reach outside services either.
- The only real Discogs call is the nightly smoke test (#69): scheduled, read-only, never on PRs.

## CI gates

Every PR runs `backend`, `frontend`, `e2e`, Branch policy (`check`), Dependency review, CodeQL
and Labeler. Required before merging:

| Target branch | Required checks |
| --- | --- |
| `develop` | `backend`, `frontend`, `e2e`, `dependency-review`, CodeQL (no high alerts), conversations resolved |
| `staging`, `main` | `backend`, `frontend`, `e2e`, `check`, CodeQL (no high alerts) |

`integration` (#94) and `system` (#95) run on every PR once merged. Add them to the rulesets
after they have run once (see [BRANCHING.md › One-time GitHub settings](BRANCHING.md#one-time-github-settings)).

## Running tests locally

Commands are in [README.md › Tests](../README.md#tests). In short: `pytest` in `backend/`,
`npm test` and `npm run e2e` in `frontend/`; MySQL and system runs need `docker compose up -d`
first.

## Staging sign-off

Before merging a `staging → main` promotion (a release-sign-off issue template will capture
this; see #75):

1. All CI checks on the promotion PR are green.
2. The staging deploy finished and its post-deploy check passed (#82, once hosting exists).
3. System tests against staging passed (#67, once hosting exists).
4. Walk through the manual checklist below on staging, on a phone and a desktop browser.
5. Note known issues in the promotion PR, then merge with **Create a merge commit**.

## Manual and exploratory checklist

Run on staging before each release, at phone and desktop size, in light and dark mode:

- [ ] Core loop: search → album → wishlist → nearby stock → hand-off → collection
- [ ] ZIP entry: valid, 4 digits, unknown ZIP, PO-box-only ZIP (e.g. 06011)
- [ ] Every radius (10, 25, 50, 100) and the empty-radius "Try … mi" action
- [ ] Stale and reported-missing listings show their labels
- [ ] Keyboard only: every control reachable and visibly focused; no traps
- [ ] Screen reader spot check (VoiceOver): headings, buttons and alerts are announced
- [ ] Slow network (DevTools "Slow 3G"): loading states show; nothing double-submits
- [ ] API down (stop the backend): "Can't reach Binhopper right now." and Try again works
- [ ] Privacy: a second account can't see the first account's collection or wishlist
- [ ] Anything that felt confusing: file an issue
