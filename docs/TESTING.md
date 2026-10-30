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
| API contract | pytest (`test_api_contract.py`) | `backend/openapi.json`, `frontend/src/api-types.ts` | The frontend's response types match the API's Pydantic models; regenerate with `python -m scripts.export_openapi` (#68) | `backend` |
| Integration | the same pytest suite on MySQL 8.4 | `TEST_DATABASE_URL` set (#94) | What SQLite hides: column precision, upserts, collation; migrations apply cleanly | `integration` (#94) |
| E2E (mocked API) | Playwright, 390 px + 1440 px; Chromium in `e2e`, WebKit + Firefox in `e2e-browsers` (#72) | `frontend/e2e/` | UI flows with the API faked by `page.route`, plus axe accessibility checks; `e2e/a11y.spec.ts` sweeps every screen (axe, 44 px targets, keyboard walkthroughs, #74) | `e2e` |
| Visual | Playwright screenshots in the Playwright Linux image | `frontend/visual/` (#73) | Key screens in light and dark at 390 and 1440 px match committed baselines (AC-14); `npm run visual:docker` compares, `npm run visual:update` accepts a deliberate change | `visual` |
| System | Playwright, real API + seeded MySQL | `frontend/e2e-system/` (#95) | The whole stack together, nothing mocked | `system` (#95) |
| Acceptance | all of the above | the table below | AC-01 to AC-21, each at the level SPEC.md names | all |

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
| AC-07 | Second report the same day: 429 + message | API | `test_reports_api.py`, `ReportPage.test.tsx`, `e2e/reports.spec.ts` | done |
| AC-08 | Heart twice adds then removes, survives reload | E2E | `e2e/wishlist.spec.ts`, `e2e-system/wishlist.spec.ts`, `WishlistPage.test.tsx`, `test_wishlist_api.py` | done |
| AC-09 | Duplicate pressing warns, "Add as 2nd copy" | Unit + E2E | `test_collection_api.py`, `CollectionPage.test.tsx`, `e2e/collection.spec.ts`, `e2e-system/collection.spec.ts` | done |
| AC-10 | Hand-off purchase moves wishlist → collection | E2E | `test_handoff_api.py`, `RecordPage.test.tsx`, `e2e/handoff.spec.ts`, `e2e-system/handoff.spec.ts` | done |
| AC-11 | Discogs import skips existing releases | API | `test_discogs_import.py`, `ImportPage.test.tsx`, `e2e/import.spec.ts` | done |
| AC-12 | Search waits for 2+ characters and a pause | Unit | — | #33 |
| AC-13 | New account is private; others get 404 | API | `test_auth_api.py`, `test_auth_google.py`, `test_account_api.py` (new accounts private); `test_wishlist_api.py`, `test_collection_api.py` (others get 404); `e2e-system/you.spec.ts` | done (a public profile page comes with sharing, Later) |
| AC-14 | "Match system" follows device dark mode | E2E | `e2e/nearby-stock.spec.ts`, `theme.test.ts`, `e2e/you.spec.ts`, `YouPage.test.tsx` | done |
| AC-15 | Account delete removes data and sign-in | API + E2E | `test_account_api.py`, `YouPage.test.tsx`, `e2e/you.spec.ts`, `e2e-system/you.spec.ts` | done |
| AC-16 | Never more than 60 Discogs calls per 60 s | Integration | — | #32, #70 |
| AC-17 | Shops without online inventory listed apart, by distance, no price | API + Unit + E2E | `test_nearby_stock_api.py`, `StoreCard.test.tsx`, `NearbyStockPage.test.tsx`, `e2e/nearby-stock.spec.ts`, `e2e-system/nearby-stock.spec.ts` | done |
| AC-18 | A "present" report moves the shop into the stock list | API + E2E | `test_reports_api.py`, `ReportPage.test.tsx`, `e2e/reports.spec.ts` (the system spec stays read-only: it shares the sample seed) | done |
| AC-19 | Verify link signs in once, expires after 24 h | API + E2E | `test_auth_api.py`, `e2e/auth.spec.ts`, `e2e-system/auth.spec.ts` | done |
| AC-20 | Same answer whether or not an email has an account | API | `test_auth_api.py`, `test_rate_limits.py`, `test_email.py` | done |
| AC-21 | Reset ends every session; link once, within 1 h | API + E2E | `test_auth_api.py`, `e2e/auth.spec.ts` | done |

Spec rules without an AC id are tested the same way and named by rule in the test:

| Rule | Tests |
| --- | --- |
| Collection rule 2: only the pressing is required; "Add condition" nudge; every grade saves and lists | `test_collection_api.py` (all 7 × 7 grade pairs, pressing-only add), `CollectionPage.test.tsx`, `e2e-system/collection.spec.ts` (each grade through the UI) |
| Collection rule 6: adding a copy takes the album off the wishlist unless the wish is for another pressing | `test_collection_api.py`, `test_handoff_api.py`, `test_discogs_import.py`, `CollectionPage.test.tsx`, `RecordPage.test.tsx`, `e2e-system/collection.spec.ts` |

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

- **Discogs, Places, Google and Resend are always mocked** in automated tests. No test may call a real outside
  API, and CI has no keys for them.
- Backend: replace the client at its boundary (a fake client or `monkeypatch`), never by
  patching `httpx` globally. Rate-limit tests use a fake clock, not real waiting.
- Frontend unit tests: stub `fetch` with `vi.spyOn(globalThis, 'fetch')`.
- E2E (mocked): fake the API with `page.route`. The system tests mock nothing, so they must not
  reach outside services either.
- Sign-in: pytest runs with `EMAIL_BACKEND=memory` (`conftest.py`) and fakes Google's token and
  key endpoints with an httpx `MockTransport` (`test_auth_google.py`); the Resend backend is
  tested the same way. The local system run uses `EMAIL_BACKEND=file` and reads the link from
  the file. Tests also use cheap Argon2 settings so hashing stays fast.
- The only real Discogs call is the nightly smoke test (#69, `.github/workflows/discogs-smoke.yml`,
  `backend/scripts/discogs_smoke.py`): two read-only GETs through the worker's queue and parser,
  scheduled and on demand, never on PRs. It needs the `DISCOGS_TOKEN` repository secret.

## CI gates

Every PR runs `backend`, `frontend`, `e2e`, Branch policy (`check`), Dependency review, CodeQL
and Labeler. Required before merging:

| Target branch | Required checks |
| --- | --- |
| `develop` | `backend`, `frontend`, `e2e`, `dependency-review`, CodeQL (no high alerts), conversations resolved |
| `staging`, `main` | `backend`, `frontend`, `e2e`, `check`, CodeQL (no high alerts) |

`integration` (#94) and `system` (#95) run on every PR once merged. Add them to the rulesets
after they have run once (see [BRANCHING.md › One-time GitHub settings](BRANCHING.md#one-time-github-settings)).

## Performance baseline

k6 load tests for nearby stock and search (`perf/`, #71), run on demand with Actions ›
Performance baseline. 10 virtual users for a minute each, against MySQL with the sample seed.
Baseline recorded 2026-10-29 on a local Mac (API with 2 workers, MySQL 8.4 in Docker):

| Endpoint | Median | p95 | Threshold (fails the run) |
| --- | --- | --- | --- |
| `GET /api/albums/{id}/stock` | 37 ms | 73 ms | p95 < 300 ms |
| `GET /api/search` | 49 ms | 77 ms | p95 < 400 ms |
| `GET /api/browse` | 47 ms | 72 ms | p95 < 400 ms |

Zero errors across 2,621 requests. Thresholds sit about 4–5× above the baseline to absorb
slower CI runners; if a change legitimately needs more, record the new numbers here and raise
the threshold in the same PR.

## Running tests locally

Commands are in [README.md › Tests](../README.md#tests). In short: `pytest` in `backend/`,
`npm test` and `npm run e2e` in `frontend/`; MySQL and system runs need `docker compose up -d`
first.

## Staging sign-off

For every `develop → staging` promotion, open a
[Release sign-off issue](../.github/ISSUE_TEMPLATE/release-signoff.md). Record the staging
commit SHA, CI/Deploy/Staging system run URLs, manual results at 390/1440 px in light/dark
mode, known issues and go/no-go. Before merging its `staging → main` promotion:

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
  (automated for every screen in `e2e/states.spec.ts`, #45; still worth one look on a real phone)
- [ ] Sign-in: create an account, open the emailed link, sign out, sign in; forgot password → reset;
  Continue with Google (staging: only your own email gets mail, only Google test users can sign in)
- [ ] Privacy: a second account can't see the first account's collection or wishlist
- [ ] Anything that felt confusing: file an issue

### Phase 4 nearby map coverage

`test_online_sellers.py` names AC-03/04 for encoded album search links, missing
artists' official shops, unsafe URLs and unknown/expired albums. Nearby stock
continues to cover AC-01–06. `StoreCard.test.tsx` covers AC-05's callable stale
stock and directions without a precise-origin parameter. Playwright nearby-stock
cases cover map pins refreshing with ZIP/radius, AC-03 widening/online fallback,
AC-04 invalid ZIP, stale calls, and screenshots at 390/1440 in light/dark modes.
`frontend/test/fixtures.ts` automatically intercepts external map/Discogs services
for **both** browser suites. System tests retain the real app API and MySQL.

### Shop directory (#47)

`test_shop_directory.py` uses a small fictional CSV, generated JSON/PBF fixtures
and MockTransport website responses: verified-only loading, override, stable-key
upserts, absence/closure retirement, reactivation, invalid-file rollback,
nullable OSM provenance, three OSM geometry kinds, robots/page limits, seller
link evidence and private-address rejection. AC-01 tests exclude inactive shops
from nearby stock and search/album/artist summaries and inventory scheduling.
`test_migrations.py` checks legacy-key backfill. The system suite checks public
OSM attribution at both widths. No tests/CI read data/raw or fetch real services.
