# Deploying Binhopper

Hosting: **Vercel Hobby** for the React app; **Railway Hobby** for FastAPI and MySQL.
Use provider domains for v1. Source flow is [develop → staging → main](BRANCHING.md).
Dashboard setup below is manual (#78, #80); committing configuration does not create services.
Never put database credentials or API keys in Git or a `VITE_` variable.

## 1. Railway dashboard (#78)

1. Create the Binhopper project on Hobby. Keep the existing `production` environment;
   create a persistent `staging` environment. Each must have its **own** MySQL service
   named `MySQL`, persistent volume, and credentials. Do not point both APIs at one database.
2. In each environment add an `api` service connected to `garrib10/binhopper`. Set source
   branch to `staging` in staging and `main` in production. Root Directory: `/backend`.
   Config File Path: `/backend/railway.json` (absolute from repository root).
3. Accept the GitHub app permissions and turn **Wait for CI** on in both API services.
   The committed config selects Railpack, watches `backend/**`, binds uvicorn to `$PORT`,
   migrates with `alembic upgrade head`, checks `/api/health`, and restarts on failure.
4. Set each API's `DATABASE_URL` to the Railway reference `${{MySQL.MYSQL_URL}}` using
   that environment's MySQL service. The backend converts the `mysql://` driver prefix
   to `mysql+pymysql://`; keep the remaining connection string intact.
5. Generate a public HTTPS domain on each API (Networking → Public Networking → Generate
   Domain). Record the staging and production origins privately; no `/api` suffix.
6. After obtaining the Vercel URLs in section 2, set `CORS_ORIGINS` separately on each API:
   a **JSON array** containing that environment's exact frontend HTTPS origin(s), no paths
   or trailing slash. Production permits its production Vercel URL; staging permits its
   stable **staging branch** Vercel URL. Do not use `*`, comma-separated text or a Python list.
7. Confirm staging uses the `environments.staging` override: migrations followed by
   `python -m scripts.seed_sample`. This fictional sample seed is safe to repeat.
   Production must use only `alembic upgrade head` and must never run sample/test seeds.
8. Enable MySQL volume backups in both environments; take a manual backup before schema
   changes and rehearse restore on staging. Check backup availability/retention in your plan.

Railway supplies `PORT` and `RAILWAY_GIT_COMMIT_SHA`. Do not hardcode them. The health
response is `status` plus `commit`; it reports process health, not database readiness.
A failing migration prevents rollout before the app starts.

**Watch-pattern consequence:** with the requested `backend/**` watch pattern, a promotion
that changes only the frontend may not deploy the API. The verifier intentionally requires
its SHA to equal the promotion SHA. For such promotions, explicitly deploy the **new branch
HEAD** through Railway's source deployment controls, then verify the SHA. Redeploying an
old deployment reuses its old code/SHA and will not satisfy this check. If the dashboard
cannot deploy the new HEAD directly, include a reviewed backend configuration change in
that promotion. Do not weaken the verifier to accept a stale SHA.

## 2. Vercel dashboard (#80)

1. Import `garrib10/binhopper` into a Hobby project owned by the repository owner.
   Root Directory: `frontend`; framework preset: Vite; install: `npm ci`;
   build: `npm run build`; output: `dist`; Node: 24.x.
2. Set Production Branch to `main` in project Git settings. The `staging` branch is a
   Preview deployment; do not make staging the production branch.
3. Add `VITE_API_BASE_URL` for **Production**, pointing to the production Railway API
   origin. Add the same name for **Preview → specific branch `staging`**, pointing to
   the staging API origin. Do not apply the production API to all previews.
4. Get the stable **branch-specific staging URL** from the staging deployment's Domains
   (the `git-staging` alias), and the production project URL. Copy the actual generated
   aliases; do not guess their names or use a per-commit preview URL. Put the staging
   alias in staging `CORS_ORIGINS` and staging `APP_URL`; use the production URL for production.
5. In Deployment Protection, make the staging preview reachable by unattended GET requests
   without a Vercel login challenge. This setup uses public fictional staging data and
   public URL variables, with no bypass secret. Confirm access in a signed-out browser.
6. Redeploy after changing Vercel environment variables: Vite embeds them at build time.
   The committed SPA rewrite serves `index.html` for non-file routes, while existing static
   files keep their normal filesystem handling. Verify a direct route reload and asset requests.

Other preview branches have no staging API access unless deliberately configured later.
An empty `VITE_API_BASE_URL` preserves the local Vite `/api` proxy. It is not a hosted API.

## 3. GitHub environment variables and gates

Under Settings → Environments, create/open `staging` and `production`. Set **Variables**
(not repository secrets):

| Setting | staging | production |
| --- | --- | --- |
| `API_URL` | Staging Railway API origin | Production Railway API origin |
| `APP_URL` | Stable staging Vercel branch origin | Production Vercel project origin |

The frontend's Vercel setting is `VITE_API_BASE_URL`; GitHub's check setting is `API_URL`.
They must point to the same API per environment. All origins include `https://`, no `/api`.
Real deployment URLs and credentials belong in dashboards, not this guide.

Keep yourself as a required reviewer on GitHub's `production` environment. Restrict staging
and production environment access to the release workflows as appropriate: these workflows
run from the default branch (`develop`) via `workflow_run`, while explicitly checking out
and verifying the promoted SHA. A branch policy allowing only `staging`/`main` would block them;
allow `develop` as well. Keep existing branch protection and required CI checks.

**Execution order:** push promotion → CI → Deploy → Staging system (staging only).
Deploy retains frontend build/backend import checks, waits up to 10 minutes for the exact
promoted SHA at `API_URL/api/health`, then requires `APP_URL` HTTP 200. Missing configuration
or an old SHA fails the check. Production never runs the staging system suite.

Deploy runs after successful CI rather than on push to avoid a cycle with Railway's
Wait for CI, which waits for all check suites on the promoted commit. A `workflow_run`
workflow's own SHA/ref are from the default branch, so Deploy checks out only the fixed trusted staging/main branch and requires HEAD to match
the triggering CI SHA (a moved branch fails until its newer run) and names the run `Deploy staging@<sha>` or `Deploy main@<sha>`.
The staging workflow validates that run name and checks out the verified staging SHA.
Both workflow files must be merged into default branch `develop` before promoting.
Production reviewer approval gates verification; provider Git autodeploy itself is controlled
by the merge to `main` and provider CI gates, not by GitHub environment approval.

## 4. First deploy

1. Review and merge the independent PRs into develop in this order: #101 (#79), #102 (#81),
   #103 (#82), #104 (#67), then the deployment-guide (#83) and release-sign-off (#75) PRs.
   No PR is stacked; the workflow dependencies become available after merging in this order.
2. Complete Railway, Vercel and GitHub settings above. Initial provider builds may fail while
   configuration or source files are missing; finish setup and retry after promotion.
3. Create a release sign-off issue for this develop → staging promotion. Actions → Promote
   → staging opens the promotion PR. Check its CI and merge using **Create a merge commit**.
   If the workflow-created PR has no CI, close/reopen it or configure PROMOTE_TOKEN as
   described in [BRANCHING.md](BRANCHING.md).
4. Wait for staging CI, Railway migrations/sample seed, and Vercel Preview. Check both
   providers built the promotion commit. Deploy must show the same API SHA and HTTP 200.
5. Wait for **Staging system**: eight read-only Playwright cases at 390 and 1440 px use
   real APP_URL/API_URL without local servers. Link the run and Deploy run in sign-off.
   Do not run local seed commands or write tests against production.
6. Manually inspect staging at 390/1440 px in light/dark mode using
   [TESTING.md](TESTING.md#manual-and-exploratory-checklist). Record unavailable future
   features as known issues; do not represent the unfinished MVP as launch complete.
7. Record go/no-go. Only after go, use Promote → main, check CI, and merge staging → main
   with a merge commit. Approve production verification when prompted. Confirm production
   API SHA, frontend HTTP 200, CORS, no fictional sample rows and monitoring.

Current nearby-stock UI uses sample album ID 1. Staging sample data supports it; production
requires a deliberately imported real catalog/store dataset before it is useful. Neither
health HTTP 200 nor a successful build proves the unfinished product is ready for launch.

For a manual staging-only rerun (from frontend, Node 24 and Playwright installed):

```bash
SYSTEM_TARGET=staging APP_URL="$STAGING_APP_URL" API_URL="$STAGING_API_URL" \
  EXPECTED_COMMIT="$STAGING_COMMIT" npm run e2e:system
```

Use actual staging origins and its promotion SHA in those local variables. No database
credentials are needed. CI uploads a Playwright report on failure; link the run in sign-off.

## 5. Better Stack dashboard

Issue #83 includes recording monitor setup; this guide does not provision it or close the
separate monitoring implementation issue. In Better Stack Uptime, create GET/HTTP-status
monitors for the production frontend and production `/api/health`, expected status 200.
Enable TLS validation, choose a check frequency available on your plan, and configure the
owner's notification destination/escalation policy. Optionally add clearly labelled staging
monitors. Verify the notification destination using the dashboard's test facility. Health
monitors only check availability; the deploy workflow checks commit identity. No Better
Stack token belongs in the app or frontend.

## 6. Rollback

**Frontend:** in Vercel Deployments select the known-good production deployment and use
Instant Rollback where available, or redeploy that known-good commit to production using
its original production settings. Verify its API origin, direct route reload, light/dark
UI and assets. For staging, restore the stable staging branch alias to a known-good preview
using available deployment controls; ensure it still uses the staging API. A provider
rollback changes serving state, not Git; follow with a reviewed correction through the
normal branch flow so the next autodeploy does not undo the recovery.

**API:** in the correct Railway environment → api → Deployments, open a previous successful
compatible deployment's menu → Rollback. Check the restored custom variables as well as
its image, database reference, CORS and health commit. Rollback is limited by provider
retention. It does not roll back MySQL. The normal deploy verifier should fail if you rerun
it expecting a newer SHA while deliberately serving the older rollback SHA; record that
recovery SHA rather than weakening the gate.

**Database/migrations:** stop promotions and pause API writes before recovery. Prefer a
reviewed forward migration compatible with the current data. An application rollback
requires schema compatibility. Never blindly run `alembic downgrade`: review its downgrade
code, rehearse it on a staging restore and take a backup first. For data loss or an unsafe
migration, restore the appropriate MySQL volume backup into an isolated recovery service,
validate the data and Alembic revision, then deliberately switch the affected environment's
DATABASE_URL reference to the recovered service. Restoring an old backup loses later writes;
record that recovery window. Keep staging and production isolated throughout. Resume service,
verify the API/catalog and frontend, and document the incident and corrected promotion.

## Provider references

- [Railway config as code](https://docs.railway.com/config-as-code/reference)
- [Railway Wait for CI](https://docs.railway.com/deployments/github-autodeploys)
- [Railway rollback and redeploy](https://docs.railway.com/deployments/deployment-actions)
- [Vercel Vite SPA configuration](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection)
- [GitHub workflow_run semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
- [Better Stack HTTP monitors](https://betterstack.com/docs/uptime/uptime-monitor/)

## Nearby map tiles (#36)

Leaflet shows ZIP-center coordinates and shop locations only; it never asks for
browser geolocation. `npm run dev` defaults to OSM's standard HTTPS tiles with
visible OpenStreetMap credit. Use ordinary browser caching, preserve Referer,
and never prefetch or bulk-download tiles; see the
[OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
The built app **has no production default tile service**: without both variables
below it shows a map-unavailable message and keeps the usable shop list.

Configure separately for Vercel Production and Preview → staging, then rebuild:

- `VITE_MAP_TILE_URL`: the provider's HTTPS **XYZ raster** template with `{z}/{x}/{y}`.
- `VITE_MAP_ATTRIBUTION`: the provider's full required credit. Text and HTTPS
  links are supported; other markup and attributes are discarded.

Provider choices, checked 2026-10-25 (confirm current terms before activating):

| Provider | Free tier and limit | Fit |
| --- | --- | --- |
| [Geoapify](https://www.geoapify.com/pricing/) | 3,000 credits/day, up to 5 requests/second; [raster tiles cost 0.25 credit/request](https://apidocs.geoapify.com/docs/maps), hence up to 12,000 tiles/day if no other APIs consume credits | Recommended starting option; provide both Geoapify and OSM attribution, including the required followed Geoapify link. |
| [Stadia Maps](https://stadiamaps.com/pricing) | 200,000 credits/month; Free excludes commercial use and has no overage. Credits are shared with other APIs; tile styles/sizes can have different costs. | Alternative for eligible personal/noncommercial deployments; commercial use needs a paid plan (Starter currently $20/month). |

Use the selected provider's dashboard-generated raster URL and attribution;
do not paste a vector style JSON URL into Leaflet. A Geoapify-style attribution
is `Powered by <a href="https://www.geoapify.com/">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>`.
Restrict any browser-public tile credential to the app's exact domains and tile
scope in the provider dashboard; frontend build values are public. Never place
DISCOGS_TOKEN or another private service credential in a VITE_ variable.
Set quota alerts and keep a hard usage cap if available. Panning and zooming use
more tiles, so tile quota is not the same as map views. A provider outage leaves
the shop list available.

Automated browser tests set an artificial tiles.binhopper.test template and
intercept it with an SVG tile fixture. Both e2e and e2e-system share an automatic
fixture blocking live Discogs/OSM/tile-provider requests; app API/MySQL calls stay
real in system tests. Remote staging tests also block those external hosts.

Online sellers are **search links**, never live stock/prices. The optional
backend `ARTIST_STORE_URLS` is a JSON object mapping internal artist IDs to
manually verified HTTPS official-store URLs, e.g. `{"123":"https://artist.example/shop"}`
(example only). An artist without a verified configured URL has no official-shop
link. This avoids guessing ownership or adding an unnecessary schema migration.

## Discogs catalog and inventory worker (#90)

From `backend/`, after `alembic upgrade head`, set `DISCOGS_TOKEN` and a unique
`DISCOGS_USER_AGENT` in the backend environment, then run `python -m app.worker`.
`python -m app.worker --once` runs one due-job pass; new shops are spread across
four hours, so this does not force every shop to sync immediately. Fill each
verified shop's `stores.discogs_seller_name` from its own website's seller link.
Unknown releases are skipped until imported from the CC0 dumps. Non-USD listings
are skipped because v1 displays USD; there is no implicit currency conversion.

In **each** Railway environment create a separate `worker` service from the same
repository and branch as its API, Root Directory `/backend`. Override its config
file to `/backend/railway.worker.json`. Set its `DATABASE_URL` to that environment's
MySQL reference, plus `DISCOGS_TOKEN` and `DISCOGS_USER_AGENT`. Keep one replica,
Wait for CI on, and no public domain. The worker config overrides the API start
command and health check; do not run it inside uvicorn. Deploy the API/migrations
first, then the worker. The MySQL advisory lease prevents overlapping workers and
all catalog/inventory calls share durable rolling quota reservations.

A failed inventory page retains the previous snapshot and retries after five
minutes; API readers hide it at six hours even while the worker is down. The
worker scrubs expired marketplace values. Watch worker failure logs and last sync
times: stale content stays hidden rather than being kept on screen. Fictional
sample/test stock is explicitly manual and never triggers seller requests.
