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
This was not a Google API lookup or scrape and does not verify the business.
After rebuilding from the OSM cache, reapply this documented correction before
reviewing the CSV; raw OSM has no hours for this row.

The user subsequently supplied a Discogs profile screenshot showing
**WillimanticRecords**, the matching 34 North Street address, a physical record/
book shop description, and `http://willimanticrecords.com`. These manual facts
replace the obsolete blog URL and the website-failure classification; they are
not an automated own-site seller-link finding. Reapply seller name, website,
`likely_status=record shop` and provenance notes after an OSM-only rebuild too.
The profile match is recorded; opening status, phone, vinyl sales and website
safety remain unconfirmed, so `verified=false` is retained. No unsafe site was
visited and no marketplace inventory/counts were copied from the screenshot.
