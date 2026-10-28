# Deploying Binhopper

Hosting: **Vercel Hobby** for the React app; **Railway Hobby** for FastAPI and MySQL.
Use provider domains for v1. Source flow is [develop → staging → main](BRANCHING.md).
Dashboard setup below is manual (#78, #80); committing configuration does not create services.
Never put database credentials or API keys in Git or a `VITE_` variable.

Decisions ([launch.md](decisions/launch.md#5-hosting-api-proxy-cost-and-pre-launch-mode)):

- **API proxied through Vercel (Option A), chosen 2026-10-25; custom domain (Option B) decided
  before launch.** The browser only talks to the app's own origin. `frontend/proxy.ts` (Vercel
  Routing Middleware, registered in `frontend/vercel.json` for `/api/:path*`) forwards each `/api`
  request to that environment's Railway API, so sign-in cookies (#38) stay first-party. The
  frontend always calls plain `/api`: Vite proxies it locally, and Vercel proxies it when deployed.
- **Binhopper stays free for users; no paid tiers.**

## 0. Pre-launch hosting mode (until v1 ships)

Decided 2026-10-27. Keep costs near zero while the MVP is unfinished. Sections 1–3 describe the
full setup; until launch, apply only the staging parts:

- **Railway:** first set a **usage limit** in the workspace's billing settings. Then create
  **only** the `staging` environment, watching the `staging` branch. Don't create a production
  environment until launch. Add MySQL and the `api` service only when you're ready to test.
  Enable **app sleeping (serverless)** on the API. Keep the `worker` service off, except while
  testing the Discogs sync. A sleeping MySQL refuses the first connection while it wakes, so
  migrations retry for up to 2 minutes (`connect_with_retry` in `app/db.py`); the deploy log
  shows "Database not ready … retrying" meanwhile.
- **Vercel:** Production Branch stays `main`, but hold back production builds under
  Settings → Git → **Ignored Build Step**, so that only the `staging` branch builds:

  ```bash
  if [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 1; else exit 0; fi
  ```

  Exit 1 means build; exit 0 means skip. This also skips other preview branches. Skipped builds
  show as Canceled and still count toward build quotas. Remove the command at launch. Set `API_ORIGIN` for **Preview → branch `staging`** to the Railway staging
  URL. Leave Production unset until launch. Keep **Deployment Protection** on, so staging stays
  private, and create a **Protection Bypass for Automation** secret for the CI checks (§2 step 5).
- **GitHub:** set `API_URL` / `APP_URL` (variables) and `VERCEL_AUTOMATION_BYPASS_SECRET` (secret) on
  the `staging` environment only. The Deploy workflow
  skips its check with a notice where these are unset, as on production before launch.
- **Don't promote `staging` → `main` until v1 is done.** Then follow
  [Going live](#going-live-v1-launch).

## 1. Railway dashboard (#78)

**The Railway dashboard is the source of truth** for service settings (decided 2026-10-27, #121).
Railway deprecated Config as Code (`railway.json`, unread after 2026-12-01), and its replacement,
Infrastructure as Code (`.railway/railway.ts`), doesn't yet document watch paths, app sleeping,
Wait for CI or restart policy, and deletes resources the file omits. Revisit it when production
is set up (#119). Until then, enter the settings below by hand and keep this table current.

1. Create the Binhopper project on Hobby with a persistent `staging` environment. At launch, add
   `production` (pre-launch: staging only, section 0). Each environment must have its **own**
   MySQL service named `MySQL`, persistent volume, and credentials. Do not point both APIs at one database.
   No public TCP proxy on MySQL.
2. In each environment add an `api` service connected to `garrib10/binhopper`, and accept the
   GitHub app permissions. Enter these settings (Settings tab):

   | Setting | `api`, staging | `api`, production |
   | --- | --- | --- |
   | Source repo / branch | `garrib10/binhopper`, `staging` | `garrib10/binhopper`, `main` |
   | Root Directory | `/backend` | `/backend` |
   | **Wait for CI** | on | on |
   | Railway Config File | **empty** | **empty** |
   | Watch Paths | `/backend/**` | `/backend/**` |
   | Builder | Railpack (default), no custom build command | same |
   | Custom Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | same |
   | Pre-deploy Command | `alembic upgrade head && python -m scripts.seed_sample` | `alembic upgrade head` **only** |
   | Healthcheck Path | `/api/health` | `/api/health` |
   | Restart Policy | On Failure | On Failure |
   | Serverless (app sleeping) | on | decide at launch (#119) |
   | Public domain | generated (step 4) | generated (step 4) |

   The sample seed is fictional and safe to repeat. Production must never run sample or test seeds.
   Railpack installs packages only from **`backend/requirements.txt`** (it skips a
   `pyproject.toml` without a lock file) and takes Python from `backend/.python-version`
   (3.12, as in CI). Add new runtime dependencies to both `pyproject.toml` and
   `requirements.txt`; `tests/test_hosting.py` fails if they differ.
3. Set each API's `DATABASE_URL` to the Railway reference `${{MySQL.MYSQL_URL}}` using
   that environment's MySQL service. The backend converts the `mysql://` driver prefix
   to `mysql+pymysql://`; keep the remaining connection string intact.
4. Generate a public HTTPS domain on each API (Networking → Public Networking → Generate
   Domain). Record each origin privately, with no `/api` suffix. It becomes that environment's
   Vercel `API_ORIGIN` and GitHub `API_URL`.
5. Leave `CORS_ORIGINS` unset on Railway. Browsers reach the API through the app's own origin,
   so no cross-origin requests happen; the default only allows local Vite dev. The API takes the
   visitor's IP and `https` scheme from `X-Forwarded-For` / `X-Forwarded-Proto` set by Vercel's
   proxy (for rate limits and secure cookies). `FORWARDED_ALLOW_IPS` defaults to `*` because
   Railway's edge connects from changing private IPs; don't change it unless you know the peers.
   Set the API's **`ORIGIN_SECRET`** as described in [Origin secret](#origin-secret-only-the-vercel-proxy-reaches-the-api),
   so direct calls to the Railway URL can't fake those headers.
6. Enable MySQL volume backups in each environment; take a manual backup before schema
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
   Preview deployment; do not make staging the production branch. Pre-launch, add the
   Ignored Build Step from section 0.
3. Add the server-side variable `API_ORIGIN` (not a `VITE_` variable, so it never reaches the
   browser bundle) for **Preview → specific branch `staging`**, set to the staging Railway API
   origin. At launch, add it for **Production** with the production Railway API origin. Do not
   apply one API to all previews. `frontend/proxy.ts` forwards `/api/*` (method, path, query,
   body and headers including `Cookie`) to that origin and returns the API's status, headers
   (including `Set-Cookie`) and body unchanged. CDN caching of proxied responses is off
   (`x-vercel-enable-rewrite-caching: 0` in `vercel.json`). If `API_ORIGIN` is missing or isn't an
   `http(s)` URL, `/api` returns 503 `{"detail":"API not configured"}`, and the app shows
   "Can't reach Binhopper right now."
4. Get the stable **branch-specific staging URL** from the staging deployment's Domains
   (the `git-staging` alias), and, at launch, the production project URL. Copy the actual
   generated aliases; do not guess their names or use a per-commit preview URL. Put the staging
   alias in the staging `APP_URL`, and the production URL in production's.
5. Keep **Deployment Protection → Vercel Authentication** on, so the staging preview stays private.
   It covers the app and its `/api` proxy. For the automated checks, open **Protection Bypass for
   Automation** in the same settings, create a secret (e.g. "GitHub staging checks"), and store it
   as the GitHub `staging` environment **secret** `VERCEL_AUTOMATION_BYPASS_SECRET` (section 3).
   The Deploy check and the staging system tests send it as the `x-vercel-protection-bypass`
   header, **only to `APP_URL`**, never to the Railway API or any other host
   (`check_deploy.py`, `frontend/test/vercel-bypass.ts`).
   - **People:** share staging with **Share** on the deployment. On Hobby, you can have only one
     "Anyone with the link" share link per account, and it belongs to one deployment, so move it
     after each promotion. Alternatively, invite people with a Vercel account to the deployment.
   - **Rotating the secret:** regenerate it in Vercel, update the GitHub secret, then redeploy staging.
     Deleting it makes the checks fail at the protection wall until a new one is stored.
   - Production domains aren't covered by standard protection, so production needs no secret.
6. Redeploy after changing Vercel environment variables: they only apply to new deployments
   (and Vite embeds `VITE_` map variables at build time). The committed SPA rewrite serves
   `index.html` for non-file routes except `/api/*`, while existing static files keep their
   normal filesystem handling, and the proxy never runs for them. Verify a direct route reload,
   asset requests, and `<app>/api/health`.

Other preview branches don't build pre-launch. If one is built later, its `/api` returns the 503
until `API_ORIGIN` is deliberately configured for it. Local dev is unchanged: `npm run dev`
proxies `/api` to `http://127.0.0.1:8000` (vite.config.ts), and no proxy middleware runs locally.

## 3. GitHub environment variables and gates

Under Settings → Environments, create/open `staging` and `production`. Set **Variables**
(not repository secrets). Pre-launch, set them on `staging` only:

| Setting | staging | production (at launch) |
| --- | --- | --- |
| `API_URL` | Staging Railway API origin | Production Railway API origin |
| `APP_URL` | Stable staging Vercel branch origin | Production Vercel project origin |

Vercel's `API_ORIGIN` and GitHub's `API_URL` must point to the same Railway API in each
environment. The deploy check fails if the app's `/api` proxy reports a different commit.
All origins include `https://`, no `/api`.
Staging also needs one environment **secret**, `VERCEL_AUTOMATION_BYPASS_SECRET` (§2 step 5).
Real deployment URLs and credentials belong in dashboards, not this guide.

Keep yourself as a required reviewer on GitHub's `production` environment. Restrict staging
and production environment access to the release workflows as appropriate: these workflows
run from the default branch (`develop`) via `workflow_run`, while explicitly checking out
and verifying the promoted SHA. A branch policy allowing only `staging`/`main` would block them;
allow `develop` as well. Keep existing branch protection and required CI checks.

**Execution order:** push promotion → CI → Deploy → Staging system (staging only).
Deploy retains frontend build/backend import checks, then:

1. Waits up to 10 minutes for the exact promoted SHA at `API_URL/api/health`.
2. Requires the same SHA at `APP_URL/api/health`, through the Vercel proxy.
3. Requires HTTP 200 from `APP_URL/api/search`, a protected endpoint, through the proxy. A 403
   fails right away with "set the same ORIGIN_SECRET on Vercel and Railway"; `/api/health` is
   exempt from that check, so it can't catch a mismatch.
4. Requires `APP_URL` to return HTTP 200.

An old SHA fails the check. If **neither** variable is set for the environment, as on production
before launch, the check is skipped with a GitHub notice. If only one is set, it fails.
Production never runs the staging system suite.

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
2. Complete the Railway, Vercel and GitHub settings above for **staging** (pre-launch, staging only:
   section 0). Initial provider builds may fail while configuration or source files are missing;
   finish setup and retry after promotion.
3. Create a release sign-off issue for this develop → staging promotion. Actions → Promote
   → staging opens the promotion PR. Check its CI and merge using **Create a merge commit**.
   If the workflow-created PR has no CI, close/reopen it or configure PROMOTE_TOKEN as
   described in [BRANCHING.md](BRANCHING.md).
4. Wait for staging CI, Railway migrations/sample seed, and Vercel Preview. Check both
   providers built the promotion commit. Deploy must show the same API SHA directly and through
   `APP_URL/api/health`, plus HTTP 200.
5. Wait for **Staging system**: eight read-only Playwright cases at 390 and 1440 px use
   real APP_URL/API_URL without local servers. Link the run and Deploy run in sign-off.
   Do not run local seed commands or write tests against production.
6. Manually inspect staging at 390/1440 px in light/dark mode using
   [TESTING.md](TESTING.md#manual-and-exploratory-checklist). Record unavailable future
   features as known issues; do not represent the unfinished MVP as launch complete.
7. Record go/no-go for staging. **Don't promote to `main` before v1 is done.** At launch, follow
   [Going live](#going-live-v1-launch), which ends with Promote → main.

Current nearby-stock UI uses sample album ID 1. Staging sample data supports it; production
requires a deliberately imported real catalog/store dataset before it is useful. Neither
health HTTP 200 nor a successful build proves the unfinished product is ready for launch.

For a manual staging-only rerun (from frontend, Node 24 and Playwright installed):

```bash
SYSTEM_TARGET=staging APP_URL="$STAGING_APP_URL" API_URL="$STAGING_API_URL" \
  EXPECTED_COMMIT="$STAGING_COMMIT" VERCEL_AUTOMATION_BYPASS_SECRET="$BYPASS_SECRET" \
  npm run e2e:system
```

Use actual staging origins and its promotion SHA in those local variables, and the bypass secret
from Vercel (don't paste it into shell history; read it from a password manager). No database
credentials are needed. CI uploads a Playwright report on failure; link the run in sign-off.

## Going live (v1 launch)

Do these in order only when v1 is done and the release sign-off says go:

1. **Railway:** create the `production` environment with its own `MySQL` and `api` service
   (section 1's production column: source branch `main`, Wait for CI, `DATABASE_URL` reference,
   public domain, backups).
   Production runs only `alembic upgrade head`, never sample seeds. Decide whether production keeps
   app sleeping. Add the `worker` service when shop stock should sync (Discogs worker section),
   and raise the usage limit to match.
2. **Vercel:** set `API_ORIGIN` for **Production** to the production Railway API origin. If the
   custom domain (Option B) was chosen, add it now and use it in the URLs below. Generate a new
   production **`ORIGIN_SECRET`** (never reuse staging's) and set it on Vercel Production first,
   then on the production `api` service ([Origin secret](#origin-secret-only-the-vercel-proxy-reaches-the-api)).
3. **Vercel:** remove the **Ignored Build Step** command (Settings → Git), so `main` builds production.
4. **GitHub:** set `API_URL` and `APP_URL` on the `production` environment, so the Deploy check
   runs instead of skipping.
5. **Shops:** load the verified shop directory into production:
   `python -m scripts.load_shops ../data/shops/connecticut.csv` through `railway run` (see
   [VERIFY.md](shops/VERIFY.md#staging-and-production-railway)), after a database backup.
6. **Promote:** use Promote → main, check CI, and merge staging → main with a merge commit.
   Approve production verification when prompted. Confirm the production API SHA directly and
   through `<app>/api/health`, frontend HTTP 200, sign-in cookies set on the app's own origin,
   no fictional sample rows, and monitoring (section 5).

## Origin secret: only the Vercel proxy reaches the API

Since #122, the API rejects `/api` requests (403 `{"detail":"Forbidden"}`) that don't carry the
`X-Origin-Secret` header. Vercel's `/api` proxy (`frontend/proxy.ts`) adds that header from its
`ORIGIN_SECRET` variable, replacing any value a client sent. Anyone calling the Railway URL
directly is refused, so they can't fake `X-Forwarded-For` past rate limits (#38). `/api/health`
stays open for Railway's health check and the Deploy check. With no `ORIGIN_SECRET`, as in local
dev and tests, nothing is checked.

**Set up, per environment (staging now, production at launch):**

1. Generate a value on your own machine and keep it in a password manager, never in Git:
   `openssl rand -hex 32`.
2. **Vercel first:** add `ORIGIN_SECRET` (type **Secret**) for that environment only: Preview →
   branch `staging`, or Production. Redeploy that environment. Sending the header before Railway
   checks it is harmless.
3. **Then Railway:** add `ORIGIN_SECRET` with the same value to that environment's `api`
   service, and apply. From then on, direct calls get 403.
4. Check: `curl -i <API_URL>/api/search` returns **403**, `curl -i <API_URL>/api/health`
   returns **200**, and the next Deploy run passes its proxied `/api/search` step.

Doing step 3 before step 2 makes every `/api` request through the app return 403 until Vercel
redeploys. The Deploy check reports exactly that.

**Rotating:** generate a new value. Set Railway's `ORIGIN_SECRET` to `new,old` and apply, which
accepts both. Set Vercel's to `new` and redeploy. Then set Railway's to `new` alone and apply.

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
its original production settings. Verify its `API_ORIGIN`, `<app>/api/health`, direct route reload,
light/dark UI and assets. For staging, restore the stable staging branch alias to a known-good preview
using available deployment controls; ensure it still uses the staging API. A provider
rollback changes serving state, not Git; follow with a reviewed correction through the
normal branch flow so the next autodeploy does not undo the recovery.

**API:** in the correct Railway environment → api → Deployments, open a previous successful
compatible deployment's menu → Rollback. Check the restored custom variables as well as
its image, database reference and health commit. Rollback is limited by provider
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

- [Railway service settings](https://docs.railway.com/guides/services); Config as Code is
  [deprecated](https://docs.railway.com/config-as-code) and [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code)
  is deferred (#121)
- [Railway Wait for CI](https://docs.railway.com/deployments/github-autodeploys)
- [Railway rollback and redeploy](https://docs.railway.com/deployments/deployment-actions)
- [Vercel Vite SPA configuration](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Routing Middleware](https://vercel.com/docs/routing-middleware) and its
  [JS reference](https://vercel.com/docs/routing-middleware/js-reference) (`proxy` property, `rewrite()`)
- [Vercel rewrites to external origins](https://vercel.com/docs/routing/rewrites#rewrites-to-external-origins)
  (forwarded headers, CDN caching)
- [Railway usage limits (cost control)](https://docs.railway.com/pricing/cost-control) and
  [app sleeping (serverless)](https://docs.railway.com/deployments/serverless)
- [Vercel Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection)
- [Vercel Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
  and [Shareable Links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links)
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
repository and branch as its API, entered in the dashboard like the API (section 1):
Root Directory `/backend`, Railway Config File empty, Watch Paths `/backend/**`,
**Wait for CI** on, Custom Start Command `python -m app.worker`, **no** pre-deploy
command, **no** healthcheck path, Restart Policy On Failure, one replica, and no public
domain. Set its `DATABASE_URL` to that environment's MySQL reference, plus
`DISCOGS_TOKEN` and `DISCOGS_USER_AGENT`. Do not run the worker inside uvicorn. Deploy the API/migrations
first, then the worker. The MySQL advisory lease prevents overlapping workers and
all catalog/inventory calls share durable rolling quota reservations.

A failed inventory page retains the previous snapshot and retries after five
minutes; API readers hide it at six hours even while the worker is down. The
worker scrubs expired marketplace values. Watch worker failure logs and last sync
times: stale content stays hidden rather than being kept on screen. Fictional
sample/test stock is explicitly manual and never triggers seller requests.
