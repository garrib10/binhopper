# Connecticut shop candidates

© OpenStreetMap contributors. This CSV is derived from OpenStreetMap and is
licensed under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OSM copyright](https://www.openstreetmap.org/copyright). Website phone/hours
and seller-link prefill are factual review aids; page text is not distributed.
Raw responses stay in gitignored `data/raw/`, never tests or CI.

## Source and limits

Source: `https://overpass-api.de/api/interpreter`, fetched **2026-10-26 UTC**
(2026-10-25 evening US Eastern). A status request with the same identifying
User-Agent returned slots available; the first query succeeded. **One successful
query total**, yielding **19 OSM objects**, not 19 verified independent businesses.
No further discovery query was made. The result falls short of the original
20–40-shop aspiration; OSM coverage is incomplete and some candidates are not
record shops. Do not pad the list with invented businesses.

Filter used:

```overpassql
[out:json][timeout:120];
area["ISO3166-2"="US-CT"][admin_level=4]->.ct;
( nwr["shop"="music"](area.ct);
  nwr["music"~"vinyl|records"](area.ct);
  nwr["shop"]["name"~"record|vinyl",i](area.ct); );
out center tags;
```

Nodes retain their coordinates; ways/areas use the bounding-box center supplied
by Overpass (or calculated locally for PBF). Missing town/address/phone/hours
remain blank. Non-area relations in PBF may have no usable coordinates; they
remain candidates but cannot load until completed. Repeated names are retained
and flagged for checking duplicates/moves; in particular, two Redscroll OSM
objects are not assumed to be two currently operating shops. Rodeo Records has
a conflicting OSM `shop=greengrocer` tag and needs checking.

## Rebuild offline

From `backend/`, with the backend virtualenv active:

```bash
python -m scripts.build_shop_candidates ../data/raw/connecticut-overpass.json
```

For the fallback Connecticut extract from
[Geofabrik](https://download.geofabrik.de/north-america/us/connecticut.html):

```bash
pip install -e ".[shops]"
python -m scripts.build_shop_candidates ../data/raw/connecticut-latest.osm.pbf
```

The builder does not download data. A future acquisition must use the same
User-Agent `Binhopper/0.1 (+https://github.com/garrib10/binhopper)`, inspect each
instance's `/api/status`, wait its stated slot interval, use a 60-second request
timeout, stop after one successful query, and use at most five attempts before
falling back to the extract. Consult current public-instance usage policies.
Record the new source/date if deliberately refreshing the snapshot.

Optional, explicit website prefill (never run in tests/CI):

```bash
python -m scripts.build_shop_candidates ../data/raw/connecticut-overpass.json --prefill-websites
```

It uses each supplied website's homepage and at most one linked contact/hours/
about page, honors robots.txt, sends the identifying User-Agent, uses 10-second
HTTP timeouts, rejects private-address destinations, bounds response size, and
caches pages/robots in `data/raw/websites/`. Cached evidence keeps its original
fetch date. Redirects stay on the supplied domain (with/without www). It never
fetches Discogs seller profiles; profile location is for human verification.
Existing OSM phone/hours are not overwritten; missing fields may be prefilled
from explicit phone/hours evidence. Seller names require an actual Discogs
seller link on the shop's site. A dead site only means **possibly** closed.

Rebuilding resets every row to `verified=false`; review the diff before replacing
an already verified directory. Preserve established shop_key values when editing
names/towns. Keys are name/town slugs; same-key collisions get an OSM-ID suffix.
Keep key identity stable across future edits, including duplicate resolution.

Hand-added shops without osm_id must say **not from OSM** in notes and cite their
own source. Their factual fields are not claimed to originate from OSM. See
[verification and loading](../../docs/shops/VERIFY.md) before importing anything.

## User-supplied correction after discovery

Willimantic Records hours were supplied by the user from its Google business-hours
listing on 2026-10-25 US Eastern: Monday–Saturday 10AM–6PM, Sunday 11AM–5PM.
They are stored as `Mo-Sa 10:00-18:00; Su 11:00-17:00`, with provenance in notes.
This was not a Google API lookup or scrape. The user subsequently confirmed the
business details as described below.
After rebuilding from the OSM cache, reapply this documented correction before
reviewing the CSV; raw OSM has no hours for this row.

The authoritative file now preserves the user's 2026-10-26 research: **20 original
rows**, including **5 verified** shops, plus **26 new unverified candidates**.
The user's signed CSV is the branch's first commit. Never run the builder over
this reviewed file: build to a temporary output and reconcile changes while
preserving existing `shop_key`, `osm_id`, verified flags and user evidence.

## Expansion research — 2026-10-26

New candidates were found through Connecticut town/city searches, music-trade
and regional shop lists, local reporting, and shops' own websites/social pages.
Each new row has no OSM ID, starts its notes with **not from OSM**, and records
its own source URLs and date. No Google Places API or bulk Google listings were
used. Earlier user-supplied listing facts remain user research.

The official [Record Store Day locator](https://recordstoreday.com/Stores)
presented an automated-access challenge; it was not bypassed. Cross-checks used
[published RSD coverage](https://dailycampus.com/2025/04/11/bringing-back-record-store-day/)
and an [official artist's RSD shop campaign](https://morersd.wallowsmusic.com/).
These are discovery aids, not proof of current participation or verification.

The cached `data/raw/connecticut-overpass.json` was rescanned for
`shop=second_hand`, `antiques`, `books`, or `hifi` with record/vinyl mentions in
tags; **zero extra objects matched**. This cache contains only the original
19 music-query objects, not a complete state extract; the wider scan cannot
find shops absent from that cache. No PBF was available locally. Web research
supplied the additional candidates; statewide coverage is not claimed complete.
The local scan summary is cached as `data/raw/ct-expansion-osm-wide.json`.

Coordinates for Records The Good Kind and new address matches come from the
[US Census geocoder](https://geocoding.geo.census.gov/geocoder/), using
`Public_AR_Current`, on 2026-10-26. Raw responses stay gitignored. Two new
candidates (Full Haus and Clocktower) did not match and retain blank coordinates;
all five verified rows have coordinates. Street interpolation is not a verified
shop entrance; check mapped locations during review.

Allowed `likely_status` values: **record shop**, **instruments only**,
**possibly closed**, **closed**, **unknown**. `closed` records a confirmed
permanent closure; `possibly closed` covers unresolved closure or former-location
leads. Both are always inactive, including with `--include-unverified`.
The four user-confirmed closures use `closed`; Redscroll's former location stays
`possibly closed`. Replay's own closure announcement supplies one additional
closed candidate. Do not confuse closed storefronts with their online accounts.

Verified rows and their notes are settled user research; no automated process
promotes new rows. Merle's is user-verified as a physical shop but its seller
**MerlesRecordRack remains unconfirmed and blank**. Willimantic's profile and
business details were confirmed by the user; its website access warning remains
separate and the unsafe site was not visited. See [VERIFY.md](../../docs/shops/VERIFY.md)
for sourced checklists and local/staging/production loading instructions.

## Verification batch 1 — 2026-10-26

The 22 unverified `record shop` rows were checked by hand (shop sites and official
social pages, plus business listings seen through web search; no Places API or bulk
listing copies). Eight became `verified=true`: Vinyl Street Co., The Nevermind Shop,
CBug's Records, Gerosa Records, Revolution Records, both Newbury Comics branches and
Retro Spin Shop. The rest stay unverified with the missing evidence in notes. Seller
`RetroSpinShop` was cleared (profile shows no business details) and `Fullhausrecords`
was added (profile shows the shop name and address). Full Haus and Clocktower now
have Census coordinates from the `Public_AR_Census2020` benchmark, since
`Public_AR_Current` did not match their exact street address. Each row's notes carry the
dated sources; see [VERIFY.md](../../docs/shops/VERIFY.md).

## Verification batch 2 — 2026-10-27

The user answered the batch-1 questions by checking the shops and their Discogs pages.
Twelve more rows were verified, bringing the total to **25 verified shops, 18 with a Discogs
seller**. Little Lost Records is now `closed` (online-only as Odd Cabinet). Semilla
Cafe + Studio was removed from the CSV (see below). Johnny's no longer
lists a website (parked domain). Revolution keeps therevct.com, which the user confirmed redirects to
the shop's GitHub Pages site. Each row's notes carry
the dated sources. Owner names were removed from earlier notes: this directory doesn't record
private individuals' names.

## Online-only Connecticut sellers (no storefront; not active shops)

These sellers have no public storefront. They are candidates for a future "local sellers
who ship" feature and **must not be re-added as shops** in `connecticut.csv`. They were
checked by the user on 2026-10-27.

| Seller | Business | Storefront | Discogs |
| --- | --- | --- | --- |
| EmporiumCT | Emporium (Connecticut) | Closed 2025 | https://www.discogs.com/seller/EmporiumCT/profile |
| replayrecordsct | Replay Records, Hamden | Closed August 2025 | https://www.discogs.com/record-stores/store/replayrecordsct/ |
| oddcabinet | Odd Cabinet, formerly Little Lost Records, Stafford Springs | Closed 2026 | https://www.discogs.com/seller/oddcabinet/profile |
| — | Paul's Boutique Records, Vernon | Closed August 2025; sells online and through live streams | — |

Replay Records, Little Lost Records and Paul's Boutique Records keep their `closed` rows in
the CSV with an empty `discogs_seller_name`, so they stay inactive.

## Removed candidates (not record shops; do not re-add)

| Former shop_key | Business | Why removed |
| --- | --- | --- |
| `semilla-cafe-studio-hartford` | Semilla Cafe + Studio, 1283 Main Street, Hartford | A cafe and studio that doesn't sell vinyl (user-confirmed 2026-10-27). It was never verified or loaded as a shop. A 2024 report of a record section in the cafe isn't current. |

Don't reuse these keys for another business.
