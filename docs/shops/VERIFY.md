# Verify the Connecticut shop directory

Every candidate currently has `verified=false`. Classification is a lead, not a
claim that a business is open or sells vinyl. Website evidence was checked on
2026-10-26 UTC; raw pages are cached locally, not committed. Confirm the seller
profile's location yourself; finding its link on a shop's site is not location
verification. Do not mark a row verified until all applicable checks below pass.

## Add a shop OSM is missing

Add a complete CSV row with a stable, unique lowercase name/town slug in shop_key,
leave osm_id blank, set verified=false, and put **not from OSM** plus source URL
and research date in notes. Obtain coordinates from a permitted public source or
manual mapping; don't guess. Fill only facts you found. Check for an existing
OSM or legacy database row first: preserve its shop_key rather than duplicating
the business. Missing name/coordinates prevent loading, even with the override.

For a duplicate or old location, retain a row marked `possibly closed`; it will
be inactive. Give each genuinely separate branch its own stable key. For a shop
confirmed open, choose `record shop`, `instruments only`, or `unknown` as supported
by evidence; a `possibly closed` row stays inactive even if verified=true.

## Load locally

From repository root: `docker compose up -d --wait`. From `backend/`, activate
the virtualenv and run:

```bash
alembic upgrade head
python -m scripts.load_shops ../data/shops/connecticut.csv
```

Set verified=true only after checking a row. `verified_at` records when a verified
row is loaded, not an automatically inferred website visit. Re-running updates
by shop_key, preserves store IDs/history, and sets source=manual. OSM IDs remain
nullable and unique. Hours are stored verbatim under `stores.hours.text`.

**This CSV is the authoritative COMPLETE directory, not a partial regional
patch.** Shops missing from it and rows marked possibly closed become active=false;
none are deleted. Existing sample/legacy shops absent from it also become inactive.
Keep all regions in the CSV when coverage expands. Validate/review the full file
before loading: an empty file is rejected and invalid loads roll back atomically.

`--include-unverified` explicitly loads unchecked rows for isolated local review;
it leaves verified_at blank and does not activate possibly-closed rows. Do not
use this override as proof of verification or for the production launch.
The loader creates shops only: real nearby stock additionally requires known
pressings and seller inventory/manual stock. Never invent listings for visibility.

## Staging and production (Railway)

Use the reviewed CSV and checkout matching the deployment. Deploy migrations to
the chosen environment first. The commands below execute **locally** through
[railway run](https://docs.railway.com/cli/run), not inside the service. Link the
correct Railway project, activate the local backend virtualenv, and run from
`backend/`. For external database access, enable that environment's MySQL TCP
proxy temporarily; [Railway supplies MYSQL_PUBLIC_URL](https://docs.railway.com/databases/mysql).
Private `*.railway.internal` URLs cannot be used from your laptop. Never print or
commit the credential. The following explicitly passes the public URL in-process,
without putting its value in shell history or changing the API's private URL:

```bash
railway run --no-local --environment staging --service MySQL python -c 'import os,runpy,sys; os.environ["DATABASE_URL"]=os.environ["MYSQL_PUBLIC_URL"]; sys.argv=["load_shops","../data/shops/connecticut.csv"]; runpy.run_module("scripts.load_shops",run_name="__main__")'
```

Check active counts, known shop details and actual matched stock on staging.
Keep a database backup before the production load; absent rows are deactivated.
After reviewing the full verified CSV and staging result, target production
explicitly (no seed commands and no include-unverified override):

```bash
railway run --no-local --environment production --service MySQL python -c 'import os,runpy,sys; os.environ["DATABASE_URL"]=os.environ["MYSQL_PUBLIC_URL"]; sys.argv=["load_shops","../data/shops/connecticut.csv"]; runpy.run_module("scripts.load_shops",run_name="__main__")'
```

Remove temporary public database access after loading if no other external
consumer needs it. The worker uses its environment's private DB reference and
only schedules active shops. No remote loads were performed by this PR.

## Per-shop verification

### Redscroll Records — Wallingford

Key: `redscroll-records-wallingford` · OSM: `node/12609227301` · Candidate status: **record shop**.

- [ ] Confirm open/current location: 69 South Turnpike Road.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: Mo-Th 11:00-18:00, Fr-Sa 11:00-19:00, Su 11:00-17:00.
- [ ] Confirm phone: (203) 265-7013.
- [ ] Confirm own website: https://redscrollrecords.com/.
- [ ] Confirm Discogs seller name **and seller-profile location**: Redscroll.

Notes: OSM name/music tag mentions records or vinyl; not verified. Same name appears on multiple OSM objects; check for duplicate/relocated shop. Own-site check 2026-10-26 UTC: https://redscrollrecords.com/. Prefilled discogs_seller_name from this page. Own-site check 2026-10-26 UTC: https://redscrollrecords.com/contact. Prefilled phone from this page. Seller link found on own site; seller-profile location still needs human confirmation.

### Merlin's Record Rack — town not supplied

Key: `merlin-s-record-rack` · OSM: `node/4139026693` · Candidate status: **record shop**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM name/music tag mentions records or vinyl; not verified.

### Paul's Boutique Records — town not supplied

Key: `paul-s-boutique-records` · OSM: `node/13613579284` · Candidate status: **record shop**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM name/music tag mentions records or vinyl; not verified.

### Redscroll Records — town not supplied

Key: `redscroll-records` · OSM: `node/6249138252` · Candidate status: **record shop**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM name/music tag mentions records or vinyl; not verified. Same name appears on multiple OSM objects; check for duplicate/relocated shop.

### Rodeo Records — New Haven

Key: `rodeo-records-new-haven` · OSM: `node/470733881` · Candidate status: **record shop**.

- [ ] Confirm open/current location: 335 Grand Avenue.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM name/music tag mentions records or vinyl; not verified. OSM shop=greengrocer conflicts with the music-name match; verify.

### Vernon Vintage Vinyl — town not supplied

Key: `vernon-vintage-vinyl` · OSM: `node/13613579285` · Candidate status: **record shop**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM name/music tag mentions records or vinyl; not verified.

### Beller's Music — town not supplied

Key: `beller-s-music` · OSM: `way/569823821` · Candidate status: **unknown**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### Dexter's Tunes, Tales, and Ales — East Hampton

Key: `dexter-s-tunes-tales-and-ales-east-hampton` · OSM: `node/8975748838` · Candidate status: **unknown**.

- [ ] Confirm open/current location: 91 Main Street.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### E.V. Music Ship — Bridgeport

Key: `e-v-music-ship-bridgeport` · OSM: `node/3470315892` · Candidate status: **unknown**.

- [ ] Confirm open/current location: 2381 Main Street.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: Mo-Sa 10:00-20:00; Su off.
- [ ] Confirm phone: +1 203 5224112.
- [ ] Confirm own website: https://www.evmusicshop.com/.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales. Own-site check 2026-10-26 UTC: https://www.evmusicshop.com/.

### Goldie & Libro Music Center — North Haven

Key: `goldie-libro-music-center-north-haven` · OSM: `node/5628062695` · Candidate status: **instruments only**.

- [ ] Confirm open/current location: 380 Washington Avenue, Unit 1.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: Mo-Fr 10:00-17:30; Sa 10:00-13:00.
- [ ] Confirm phone: +1-203-239-2263.
- [ ] Confirm own website: https://www.goldielibro.com/.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales. Own-site check 2026-10-26 UTC: https://goldielibro.com/. Own website describes instruments/lessons/rentals; vinyl sales not established. Own-site check 2026-10-26 UTC: https://goldielibro.com/about. Own website describes instruments/lessons/rentals; vinyl sales not established.

### Litchfield Music Center — town not supplied

Key: `litchfield-music-center` · OSM: `node/8901822437` · Candidate status: **unknown**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### Progressive music — town not supplied

Key: `progressive-music` · OSM: `node/4121678592` · Candidate status: **unknown**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: +1 203 8760441.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### Sam Ash Music Store — New Haven

Key: `sam-ash-music-store-new-haven` · OSM: `node/7270851418` · Candidate status: **unknown**.

- [ ] Confirm open/current location: 95 Amity Road.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### Shaboo Productions — Willimantic

Key: `shaboo-productions-willimantic` · OSM: `way/886868896` · Candidate status: **instruments only**.

- [ ] Confirm open/current location: 2 Natchaug Street.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: +1 860 423 5700.
- [ ] Confirm own website: https://www.shabooproductions.com/.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales. Own-site check 2026-10-26 UTC: https://www.shabooproductions.com/. Own website describes instruments/lessons/rentals; vinyl sales not established.

### Song-a-Day Music — town not supplied

Key: `song-a-day-music` · OSM: `node/7393820268` · Candidate status: **unknown**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### The Music Bureau — town not supplied

Key: `the-music-bureau` · OSM: `node/12536179401` · Candidate status: **unknown**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### Tracy's Tunes — town not supplied

Key: `tracy-s-tunes` · OSM: `node/11851522753` · Candidate status: **unknown**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### Tumbleweeds Music & More — town not supplied

Key: `tumbleweeds-music-more` · OSM: `node/8169569417` · Candidate status: **unknown**.

- [ ] Confirm open/current location: address not supplied.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: not supplied.
- [ ] Confirm own website: not supplied.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM shop=music alone does not establish vinyl sales.

### Willimantic Records — Willimantic

Key: `willimantic-records-willimantic` · OSM: `node/8018607486` · Candidate status: **possibly closed**.

- [ ] Confirm open/current location: 34 North Street.
- [ ] Confirm it sells vinyl records; resolve instrument-only/closure/duplicate concerns.
- [ ] Confirm hours: not supplied.
- [ ] Confirm phone: +1 860 450 7000.
- [ ] Confirm own website: http://blog.willimanticrecords.com.
- [ ] Confirm Discogs seller name **and seller-profile location**: no own-site seller link found; do not guess.

Notes: OSM name/music tag mentions records or vinyl; not verified. Website unavailable (gaierror); business closure NOT confirmed.
