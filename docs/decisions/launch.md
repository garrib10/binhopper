# Launch decisions: Discogs terms, places provider, name, metro

Status: **draft recommendations** for #46, researched 2026-10-24. Nothing here is decided until
you approve it. The launch metro is a question for you (last section).

**The short version:** Discogs' API terms are stricter than SPEC.md assumes. Content from the API
can't be shown if it's more than 6 hours behind Discogs, and shop inventory counts as restricted
"Marketplace Data". So the catalog should come from Discogs' CC0 monthly dumps, and shop stock
needs a much faster refresh than "once a day". Google Places doesn't fit the planned non-Google
map or the permanent `stores` table; for 20–40 hand-mapped shops, use OpenStreetMap or Foursquare's
open dataset plus manual checks. The custom domain is deferred: launch on the Vercel and Railway
addresses (`binhopper.com` is already registered).

## 1. Discogs API terms: caching data and images

What the [API Terms of Use][discogs-tou] (last updated May 27, 2025) say, and what it means here:

| Topic | What the terms say | Impact on Binhopper |
| --- | --- | --- |
| Freshness | "You may not display in any format or to any audience the Content if it is more than six (6) hours older than the information on Our online properties" | SPEC's daily inventory sync and 30-day catalog refresh both break this for API data |
| Caching | "You may not cache or store the Content longer than is necessary to provide a service to Your application's users" | API responses are a short-lived cache, not our database |
| CC0 data | Release titles, track listings, barcodes, credits, artist and label names are "CC0 Data" | Catalog fields we need are CC0, but taking them through the API still binds us to the 6-hour rule |
| Restricted data | "Marketplace Data" (inventory, pricing, sales history) and "Discogs User Data" are restricted, not CC0 | Shop inventory synced from Discogs sellers (#90) is restricted data |
| Images | User-contributed images must be public domain, CC0, or used under fair use; images are not in the CC0 list | Don't copy or re-host cover images; treat them as third-party content |
| Notices | App-wide: "This application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs…". Next to any Discogs data: "Data provided by Discogs.", linked to the discogs.com page, without `nofollow` | UI work on album pages and store cards (#35, #36) |
| Money | Commercial use is generally allowed, but not "charging a fee to use or access any part of Your application that integrates with Our API… if we provide that access to users free of charge, without Our express written permission"; no restricted data on ad platforms | Keep Binhopper free, or get written permission before charging |
| Rate limit | 60 requests/min authenticated, 25 unauthenticated, per IP; send a unique User-Agent (as given in copies of the [API docs][discogs-ratelimit]; discogs.com blocks automated reads of its own page) | Matches SPEC; read the `X-Discogs-Ratelimit-*` headers instead of hard-coding |

The [monthly data dumps][discogs-dumps] of releases, artists, labels and masters are "made available
under the CC0 No Rights Reserved license". A CC0 copy we download is ours to keep and refresh on our
own schedule, which the API copy is not.

**Recommendations**

1. **Catalog (#32):** seed and refresh artists, albums, pressings and genres from the monthly CC0
   dumps. Use the API only for gaps (a release newer than the last dump), and refresh or drop those
   rows within 6 hours, or replace them from the next dump.
2. **Shop stock (#90):** treat Discogs inventory as restricted, 6-hour data. Either sync each mapped
   shop at least every 6 hours (40 shops is well within 60 calls/min unless a shop has many thousands
   of listings), or stop showing a Discogs-sourced listing once its sync is older than 6 hours.
   User reports and manual stock aren't Discogs content, so the 7-day "May be out of date" rule can
   stay for those.
3. **Images:** show cover images from the URL Discogs returns, without storing the files; don't
   re-host them. Fall back to a placeholder.
4. **Notices:** add the app-wide notice to the terms/about page (#85) and "Data provided by Discogs"
   with a followed link wherever Discogs data appears.
5. **Business model:** stay free for users at launch. Any paid tier needs Discogs' written
   permission first.
6. **Ask Discogs:** email Discogs API support to confirm the 6-hour rule applies to shop inventory
   shown inside a third-party app, and whether a longer window is possible.

## 2. Places provider: Google Places vs alternatives

| | Google Places API (New) | Foursquare Places API | OpenStreetMap (Overpass/extract) | Foursquare Open Source Places |
| --- | --- | --- | --- | --- |
| Price | Per-SKU free caps, then per 1,000: Text/Nearby Search Pro $32 (5,000 free/mo), Place Details Essentials $5 (10,000 free), Pro $17 (5,000 free) ([pricing][google-pricing]) | Pro endpoints: 0–500 calls free, then $15 CPM to 100k; up to 10,000 free sandbox calls; Premium (photos, tips) $18.75 CPM ([pricing][fsq-pricing]) | Free | Free download (registration and token) |
| Storing results | Only latitude/longitude, for up to 30 days, then delete (§14.3) ([terms][google-terms]) | Not confirmed: the retention rules sit in a separately linked Places API agreement that I couldn't retrieve ([developer terms][fsq-terms]) | Allowed | Allowed |
| Which map | Usable without a map, but **not with a non-Google map** (§14.2); the Places UI Kit is the exception (§15.1) | Not stated in what I could read | Any | Any |
| License / credit | Google attribution | Per agreement | ODbL: credit OpenStreetMap; share-alike applies if you distribute a database built from it ([copyright][osm-copyright]) | Apache 2.0, keep the license and notice ([docs][fsq-os]) |
| Data quality | Best hours, phone and status | Good | Varies by city; shops often listed, hours patchy | Good coverage, refreshed periodically |

SPEC.md plans a Mapbox GL or Leaflet map and a permanent `stores` table. Google Places' terms rule
out both: its content can't go on a non-Google map, and coordinates can only be kept for 30 days.

**Recommendation:** for v1's 20–40 shops (#47), don't use a live places API. Build the shop list
once from OpenStreetMap and Foursquare Open Source Places, check each shop by hand (phone, hours,
website, Discogs seller name), and store it as `source = "manual"`. Credit OpenStreetMap where its
data is shown. Revisit a paid API (Foursquare first, after confirming its retention terms) only if
keeping hours current by hand becomes a burden. If you'd rather keep a Google map, Google Places
becomes viable but adds 30-day re-fetching and per-call costs.

## 3. Name: domain and trademark

**Decision (2026-10-24): deferred.** Run staging and production on the default Vercel and Railway
addresses (`*.vercel.app`, `*.up.railway.app`) and sort out a custom domain and the trademark
search before the public launch. The findings below are kept for then.

**Domains** (checked through each registry's RDAP service, 2026-10-24):

| Domain | Status |
| --- | --- |
| binhopper.com | **Registered** since 2025-04-03 (expires 2027-04-03); serves an empty page |
| binhopper.app | Not registered (Google Registry) |
| binhopper.net | Not registered (Verisign) |
| getbinhopper.com, binhopperapp.com | Not registered |
| binhopper.io, .co, .fm | No RDAP answer; check at a registrar |

If binhopper.com isn't yours: register `binhopper.app` (HTTPS-only by default, fits a web app) and
`getbinhopper.com`, or make an offer for `.com` through a broker.

**USPTO search (do this before launch):** use the free [Trademark Search system][uspto-search]
([how-to][uspto-howto]):

1. Open tmsearch.uspto.gov and switch to **expert mode**.
2. Exact search: `CM:binhopper`, then variants: `CM:/.*bin ?hop.*/` and sound-alikes such as
   "binhop", "bin hopper", "crate hopper".
3. Filter to **live** marks. Look closely at classes 9 (software and apps), 35 (retail and
   marketplace services) and 42 (software as a service). Related goods can conflict even in other
   classes.
4. Save the results. If anything close shows up, talk to a trademark attorney before launch.

## 4. Launch metro: your call

The mockups use New York (ZIP 10011). Three ways to choose:

| Option | Pros | Cons |
| --- | --- | --- |
| **New York City** | Matches the mockups and sample data; many shops and many that sell on Discogs; large collector base | Too many shops to cover well with 20–40; launching against a crowded scene; hard to visit shops yourself |
| **Your home metro** | You can visit shops, recruit beta testers you know, and check stock in person | Fewer shops; may be thin on Discogs sellers; the mockups' sample data needs replacing |
| **A mid-size record city** (for example Philadelphia, Austin or Portland) | 20–40 shops covers most of the scene; strong collector communities | You may not know it well; remote shop verification |

**Question for you:** which metro? If it's not NYC, tell me a central ZIP and I'll update the
sample data and #47.

## Proposed SPEC.md changes (not applied)

In **Open decisions**, once you approve:

```markdown
- [x] Backend language: decided, Python (FastAPI) with MySQL 8
- [ ] Launch metro area: <your choice>, central ZIP <zip>
- [ ] Name: decided, Binhopper. Launch on the default Vercel and Railway addresses; choose a
      custom domain (binhopper.com is taken as of 2026-10-24) and run a USPTO search before the
      public launch
- [x] Places provider: none at launch. Shops are hand-mapped from OpenStreetMap and Foursquare Open
      Source Places and stored as manual; Google Places rules out non-Google maps and permanent storage
- [x] Discogs terms: API content may not be shown more than 6 hours behind Discogs; catalog comes
      from the CC0 monthly dumps; shop inventory is restricted data; show both required notices
```

In **Data sources › Refresh rules**, replace the first and third bullets with:

```markdown
- Shop inventories from Discogs sync at least every 6 hours; a Discogs-sourced listing older than
  6 hours is hidden (Discogs API Terms of Use). Manual and user-reported stock keep the 7-day rule.
- Catalog data comes from the monthly CC0 data dumps; API lookups fill gaps and are refreshed or
  replaced within 6 hours.
```

## Sources

All accessed 2026-10-24.

- [Discogs API Terms of Use][discogs-tou] (last updated May 27, 2025; read through the Internet
  Archive copy of 2026-05-30, because discogs.com blocks automated requests)
- [Discogs monthly data dumps (CC0)][discogs-dumps]
- [Discogs API rate limiting, as reproduced in an OpenAPI copy of the official docs][discogs-ratelimit]
- [Google Maps Platform pricing][google-pricing]
- [Google Maps Platform Service Specific Terms, §14 Places API][google-terms]
- [Foursquare pricing][fsq-pricing]
- [Foursquare Developer Master Terms of Service][fsq-terms]
- [Foursquare Open Source Places][fsq-os]
- [OpenStreetMap copyright and license][osm-copyright]
- [USPTO Trademark Search][uspto-search] and [Federal trademark searching][uspto-howto]
- Domain status: RDAP lookups through [rdap.org](https://rdap.org), answered by Verisign (.com,
  .net) and Google Registry (.app)

[discogs-tou]: https://web.archive.org/web/20260530143749/https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use
[discogs-dumps]: https://data.discogs.com/
[discogs-ratelimit]: https://repo.rock-n-code.com/rock-n-code/discogs-service/blame/tag/v0.6.0/Sources/DiscogsService/openapi.yaml
[google-pricing]: https://developers.google.com/maps/billing-and-pricing/pricing
[google-terms]: https://cloud.google.com/maps-platform/terms/maps-service-terms
[fsq-pricing]: https://foursquare.com/pricing/
[fsq-terms]: https://foursquare.com/legal/terms/developermasterterms/
[fsq-os]: https://docs.foursquare.com/data-products/docs/fsq-places-open-source
[osm-copyright]: https://www.openstreetmap.org/copyright
[uspto-search]: https://tmsearch.uspto.gov/
[uspto-howto]: https://www.uspto.gov/trademarks/search/federal-trademark-searching
