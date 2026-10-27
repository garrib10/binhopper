# Verify the Connecticut shop directory

The authoritative CSV contains **46 rows: 5 user-verified and 41 unverified**.
The 20-row user research supplied on **2026-10-26** is settled. Existing shop keys
and OSM IDs are preserved; the four requested permanent closures and Census
coordinates for Records The Good Kind are explicit amendments. The 26 newly
researched candidates stay `verified=false`, even when a shop links its seller.

Checked items below reflect the user’s settled research, not a new automated
certification. Read each row’s evidence and sources. A linked Discogs account
establishes association; confirm its seller profile location before verifying a
new shop. Unknown facts remain blank. `closed` means confirmed permanent closure;
`possibly closed` means closure/old-location evidence still needs resolution.
Both are always inactive. Other allowed statuses: `record shop`,
`instruments only`, `unknown`.

## Add a shop OSM is missing

Add a complete CSV row with a stable, unique lowercase name/town slug in shop_key,
leave osm_id blank, set verified=false, and put **not from OSM** plus source URL
and research date in notes. Obtain coordinates from a permitted public source or
manual mapping; don't guess. Fill only facts you found. Check for an existing
OSM or legacy database row first: preserve its shop_key rather than duplicating
the business. Missing name/coordinates prevent loading, even with the override.

For a duplicate or old location, retain a row marked `possibly closed` (or `closed` after permanent closure is confirmed); it will
be inactive. Give each genuinely separate branch its own stable key. For a shop
confirmed open, choose `record shop`, `instruments only`, or `unknown` as supported
by evidence; a `possibly closed` or `closed` row stays inactive even if verified=true.

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
patch.** Shops missing from it and rows marked possibly closed or closed become active=false;
none are deleted. Existing sample/legacy shops absent from it also become inactive.
Keep all regions in the CSV when coverage expands. Validate/review the full file
before loading: an empty file is rejected and invalid loads roll back atomically.

`--include-unverified` explicitly loads unchecked rows for isolated local review;
it leaves verified_at blank and does not activate possibly-closed or closed rows. Do not
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

### Merle's Record Rack — Orange

Key: `merlin-s-record-rack` · OSM: `node/4139026693` · Status: **record shop** · verified=true.

- [x] Open/current location: 307 Racebrook Road — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: We-Fr 10:00-15:00; Sa 10:00-16:00; Mo,Tu,Su off — user research, 2026-10-26.
- [x] Current phone: +1 203 795 9033 — user research, 2026-10-26.
- [x] Official website/social identity: http://merlesrecordrack.com — user research, 2026-10-26.
- [ ] Confirm Discogs seller **MerlesRecordRack**: does this account belong to Merle’s Record Rack at 307 Racebrook Road, Orange, CT? Ask the shop or match business name/address/phone on its seller profile. Username alone is insufficient; CSV seller stays blank.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: OSM name misspelled ("Merlin's"); same business at these coordinates. Address/phone/website per Patch listing (2022) and Closo registry (checked 2026-10-01, from map listing); hours from Closo only. Sells new and used LPs, CDs, cassettes (Orange Times, 2022-08-05). No Discogs seller established. User confirmed 2026-10-26 from the Google listing: record store, vinyl and CDs plus vintage audio and repair; 307 Racebrook Rd, Orange CT 06477; (203) 795-9033; hours Wed-Fri 10-3, Sat 10-4, closed Sun-Tue (matches). Likely Discogs seller: MerlesRecordRack (name match only; profile shows no address or phone; unconfirmed, field left blank).

### Records - The Good Kind — Vernon

Key: `records-the-good-kind-vernon` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 435 Hartford Turnpike — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: Mo off; Tu 12:00-17:00; We 12:00-18:00; Th-Sa 12:00-19:00; Su 12:00-17:00 — user research, 2026-10-26.
- [x] Current phone: +1 860 872 5506 — user research, 2026-10-26.
- [x] Official website/social identity: http://recordsthegoodkind.com — user research, 2026-10-26.
- [x] Confirm Discogs seller and seller-profile location: **lostsocks** — user research, 2026-10-26.

Evidence / sources (research 2026-10-26): Not from OSM. Found 2026-10-26 via Google Maps listing (147 reviews; recent reviews describe a used-record shop with graded and bargain vinyl, visited Oct 2025); also listed on Giftly (giftly.com/gift-card/records-the-good-kind-vernon). Needs lat/lng from a permitted source (e.g. US Census geocoder) before loading. User confirmed 2026-10-26 from the Google listing: record store (vinyl LPs, CDs, cassettes), located in Shops At 30, 435 Hartford Turnpike, Vernon CT 06066; (860) 872-5506; hours match. Still needs lat/lng before it can load. Discogs seller lostsocks (found by user 2026-10-26): business seller profile shows Records The Good Kind, 435Q Hartford Tpke, Vernon CT, phone 8608725506, matching this shop (unit Q). About 86 items for sale. Website recordsthegoodkind.com per Redscroll's 2023 record fair vendor list (owner Ian Schlein). coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 435 HARTFORD TPKE, VERNON, CT, 06066.

### Redscroll Records — Wallingford

Key: `redscroll-records-wallingford` · OSM: `node/12609227301` · Status: **record shop** · verified=true.

- [x] Open/current location: 69 South Turnpike Road, Unit B — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: Mo-Th 11:00-18:00, Fr-Sa 11:00-19:00, Su 11:00-17:00 — user research, 2026-10-26.
- [x] Current phone: (203) 265-7013 — user research, 2026-10-26.
- [x] Official website/social identity: https://redscrollrecords.com/ — user research, 2026-10-26.
- [x] Confirm Discogs seller and seller-profile location: **Redscroll** — user research, 2026-10-26.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Own site (redscrollrecords.com/marketing-menu) lists 69 South Turnpike Road Unit B, Wallingford CT 06492, these hours, and links discogs.com/seller/Redscroll. Phone matches own contact page and Closo registry (checked 2026-10-01). Current location; node/6249138252 is the former downtown location.

### Tumbleweeds Music & More — Niantic

Key: `tumbleweeds-music-more` · OSM: `node/8169569417` · Status: **record shop** · verified=true.

- [x] Open/current location: 325 Main Street, Suite 1 — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: Mo-Th 10:00-18:00; Fr-Sa 10:00-19:00; Su 11:00-18:00 — user research, 2026-10-26.
- [x] Current phone: +1 860 739 9018 — user research, 2026-10-26.
- [x] Official website/social identity: https://tumbleweedsct.com — user research, 2026-10-26.
- [x] Confirm Discogs seller and seller-profile location: **tumbleweedsgirl** — user research, 2026-10-26.

Evidence / sources (research 2026-10-26): Verified 2026-10-26 at user's direction from the Google Maps listing (Tumbleweeds, 325 Main St, Niantic CT 06357; 226 reviews; recent reviews mention vinyl, CDs, restored stereos and owner Tara). Listing location matches this OSM node; owner matches the Women in Vinyl profile (Tara Wyatt; new and used vinyl, CDs, tapes; tumbleweedsct.com, @tumbleweedsct). Second overflow location not listed separately. No Discogs seller established. Discogs seller tumbleweedsgirl (found by user 2026-10-26): business seller profile lists Tumbleweeds, 325 Main St Ste 1, Niantic CT, phone 860-739-9018, matching this shop; listings mention pickup in Niantic. About 9,100 items for sale.

### Willimantic Records — Willimantic

Key: `willimantic-records-willimantic` · OSM: `node/8018607486` · Status: **record shop** · verified=true.

- [x] Open/current location: 34 North Street — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: Mo-Sa 10:00-18:00; Su 11:00-17:00 — user research, 2026-10-26.
- [x] Current phone: +1 860 450 7000 — user research, 2026-10-26.
- [x] Official website/social identity: http://willimanticrecords.com — user research, 2026-10-26.
- [x] Confirm Discogs seller and seller-profile location: **WillimanticRecords** — user research, 2026-10-26.

Evidence / sources (research 2026-10-26): User-confirmed on 2026-10-26 US Eastern: open physical shop selling vinyl, current address 34 North Street, phone +1 860 450 7000, and hours Mo-Sa 10:00-18:00; Su 11:00-17:00. User-supplied Discogs profile shows WillimanticRecords and the matching address; website http://willimanticrecords.com is identified by that profile. User reported a browser security warning; website was not visited and is not certified safe. The obsolete blog lookup failure is not evidence of business closure. Verification is based on user confirmation, not an independent automated business check.

Website access warning reported by user; no unsafe-site visit or safety certification. Shop identity and operation remain user-confirmed.

### Beller's Music — Manchester

Key: `beller-s-music` · OSM: `way/569823821` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Locable listing: instrument sales, rentals, repairs and instruction; no records mentioned. Affiliated with DuBaldo Music Center.

### CBug's Records — East Windsor

Key: `cbug-s-records-east-windsor` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 42 Bridge Street, second floor, East Windsor, CT 06088.
- [ ] Sells vinyl records.
- [ ] Current hours: Tu-Sa 10:00-17:00; Su 12:00-17:00.
- [ ] Current phone: 860-519-4725.
- [ ] Official website/social identity: https://www.cbugsrecords.com/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site confirms vinyl shop on second floor of The Vintage Shops; Monday unspecified. Sources: https://www.cbugsrecords.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 42 BRIDGE ST, EAST WINDSOR, CT, 06088.

### Clocktower Records — Thomaston

Key: `clocktower-records-thomaston` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 135 South Main Street, second floor tower, Thomaston, CT.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 860-463-3092.
- [ ] Official website/social identity: https://www.clocktowerrecords.net/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.
- [ ] Obtain coordinates: Census did not return a Connecticut match; latitude/longitude stay blank.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site describes family vinyl store; certificate could not be validated in local client, so no insecure TLS bypass. Newspaper 2025-10-18 confirms opening and phone; weekend hours vary, confirm current schedule. Sources: https://www.clocktowerrecords.net/; https://www.thehour.com/waterbury/article/thomaston-clocktower-records-vinyl-21100193.php. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; no Connecticut match; left blank.

### Dexter's Tunes, Tales, and Ales — East Hampton

Key: `dexter-s-tunes-tales-and-ales-east-hampton` · OSM: `node/8975748838` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Used books and records with beer/wine (East Hampton town filing, 2019). Patch 2026-02-09: last day of business March 31, 2026.

### Disc & Dat — Bethel

Key: `disc-dat-bethel` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 107 Greenwood Avenue, Bethel, CT 06801.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 203-797-0067.
- [ ] Official website/social identity: https://www.instagram.com/discanddat/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Local owner interview describes physical record shop and gives address/phone; official social linked by individual directory. Current hours not directly established. Sources: https://www.instagram.com/discanddat/; https://www.bethelgrapevine.com/articles/national-record-store-day-go-check-out-bethels-disc-dat; https://recordstore.com/store/disc-dat-bethel-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 107 GREENWOOD AVE, BETHEL, CT, 06801.

### E.V. Music Ship — Bridgeport

Key: `e-v-music-ship-bridgeport` · OSM: `node/3470315892` · Status: **unknown** · verified=false.

Excluded from the verified record-shop directory: unknown. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Google Maps listing checked 2026-10-26: "EV MUSIC SHOP", 2381 Main St; categorized as cell phone/electronics store; reviews mention computers, wireless, IPTV and music generally. No evidence of vinyl. HomeGuide: CDs, duplication, computer repair.

### Exile on Main Street — Branford

Key: `exile-on-main-street-branford` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 267 East Main Street, Branford, CT 06405.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 203-483-6228.
- [ ] Official website/social identity: https://exileonmain.com/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Connecticut Public reporting interviews vinyl-shop owners; individual directory supplies address/contact and official domain. Confirm current hours. Sources: https://exileonmain.com/; https://www.vermontpublic.org/2023-01-30/vinyl-album-sales-keep-rising-as-ct-customers-seek-warm-authentic-sounds-of-favorite-record; https://recordstore.com/store/exile-on-main-st-branford-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 267 E MAIN ST, BRANFORD, CT, 06405.

### Full Haus Records — Norwalk

Key: `full-haus-records-norwalk` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 16 Knight Street, Norwalk, CT 06851.
- [ ] Sells vinyl records.
- [ ] Current hours: Th-Fr 12:00-17:00; Sa-Su 12:00-19:00.
- [ ] Current phone: 475-470-8445.
- [ ] Official website/social identity: https://fullhausrecords.com/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.
- [ ] Obtain coordinates: Census did not return a Connecticut match; latitude/longitude stay blank.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site sells vinyl and provides storefront/contact/hours. Sources: https://fullhausrecords.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; no Connecticut match; left blank.

### Gerosa Records — Brookfield

Key: `gerosa-records-brookfield` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 246 Federal Road, Brookfield, CT.
- [ ] Sells vinyl records.
- [ ] Current hours: We-Sa 10:00-18:00; Su 11:00-17:00.
- [ ] Current phone: 203-775-7074.
- [ ] Official website/social identity: https://gerosarecords.com/.
- [ ] Confirm Discogs seller and seller-profile location: **gerosarecords**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site confirms new/used vinyl, hours and contact. Dedicated online stores page explicitly links seller gerosarecords. Sources: https://gerosarecords.com/; https://gerosarecords.com/gerosa-records-ebay-discogs/; https://gerosarecords.com/contact/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 246 FEDERAL RD, BROOKFIELD, CT, 06804.

### Goldie & Libro Music Center — North Haven

Key: `goldie-libro-music-center-north-haven` · OSM: `node/5628062695` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): OSM shop=music alone does not establish vinyl sales. Own-site check 2026-10-26 UTC: https://goldielibro.com/. Own website describes instruments/lessons/rentals; vinyl sales not established. Own-site check 2026-10-26 UTC: https://goldielibro.com/about. Own website describes instruments/lessons/rentals; vinyl sales not established.

### GRAILS — New Haven

Key: `grails-new-haven` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 1020 Chapel Street, lower level, New Haven, CT 06510.
- [ ] Sells vinyl records.
- [ ] Current hours: Mo-Sa 11:00-19:00.
- [ ] Current phone: not established.
- [ ] Official website/social identity: https://www.grailsonchapel.com/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site describes rare original vinyl and reissues. Sunday hours and phone not established. Sources: https://www.grailsonchapel.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 1020 CHAPEL ST, NEW HAVEN, CT, 06510.

### Johnny's Records — Darien

Key: `johnny-s-records-darien` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 45 Tokeneke Road, Darien, CT 06820.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 203-655-0157.
- [ ] Official website/social identity: https://johnnysrecords.com/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own indexed site describes rare vinyl and 50th anniversary. Individual listing confirms address/phone; local client connection reset is not closure evidence. Hours need direct confirmation. Sources: https://johnnysrecords.com/; https://recordstore.com/store/johnny-s-records-darien-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 45 TOKENEKE RD, DARIEN, CT, 06820.

### Litchfield Music Center — Litchfield

Key: `litchfield-music-center` · OSM: `node/8901822437` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Google Maps listing checked 2026-10-26: music lessons and piano showroom/tuning; reviews mention lessons and pianos, no records.

### Little Lost Records — Stafford Springs

Key: `little-lost-records-stafford-springs` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 83 Main Street, Stafford Springs, CT.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: not established.
- [ ] Official website/social identity: not established.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Local newspaper owner interview dated 2024-07-14 confirms physical vinyl store. Current hours, phone, official website and seller identity not established. Sources: https://www.staffordfreepress.com/post/little-lost-records-celebrates-a-year-in-business. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 83 MAIN ST, STAFFORD SPRINGS, CT, 06076.

### Music Outlet — Enfield

Key: `music-outlet-enfield` · OSM: `none (not from OSM)` · Status: **possibly closed** · verified=false.

Excluded from the verified record-shop directory: possibly closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. 2023 local news reports closing sale; individual record directory now marks permanently closed. Confirm final closure if needed; retain inactive. Sources: https://patch.com/connecticut/enfield/music-institution-enfield-close-after-four-decades-business; https://www.vinylworld.org/record-shop/music-outlet/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 151 HAZARD AVE, ENFIELD, CT, 06082.

### Mystic Disc — Mystic

Key: `mystic-disc-mystic` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 10 Steamboat Wharf, Mystic, CT 06355.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 860-536-1312.
- [ ] Official website/social identity: https://www.instagram.com/mystic_disc/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Long-running physical vinyl shop; individual store profile identifies official social, address and phone. Avoid erroneous listings placing it in Waterbury. Sources: https://www.instagram.com/mystic_disc/; https://recordstore.com/store/mystic-disc-mystic-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 10 STEAMBOAT WHARF, MYSTIC, CT, 06355.

### Newbury Comics — Danbury

Key: `newbury-comics-danbury` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 7 Backus Avenue, Space B215, Danbury, CT 06810.
- [ ] Sells vinyl records.
- [ ] Current hours: Mo-Th 10:00-20:00; Fr-Sa 10:00-21:00; Su 11:00-19:00.
- [ ] Current phone: 475-348-7561.
- [ ] Official website/social identity: https://www.newburycomics.com/pages/locations/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Official chain locator confirms Danbury Fair branch/contact/hours; chain sells vinyl. Separate Manchester CT branch, not Manchester NH. Sources: https://www.newburycomics.com/pages/locations/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 7 BACKUS AVE, DANBURY, CT, 06810.

### Newbury Comics — Manchester

Key: `newbury-comics-manchester` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 194 Buckland Hills Drive, Manchester, CT 06040.
- [ ] Sells vinyl records.
- [ ] Current hours: Mo-Th 10:00-20:00; Fr-Sa 10:00-21:00; Su 11:00-18:00.
- [ ] Current phone: 860-648-2411.
- [ ] Official website/social identity: https://www.newburycomics.com/pages/locations/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Official chain locator confirms Shoppes at Buckland Hills branch/contact/hours; chain sells vinyl. No location-specific seller confirmed. Sources: https://www.newburycomics.com/pages/locations/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 194 BUCKLAND HILLS DR, MANCHESTER, CT, 06042.

### Oldies & Goodies — Wallingford

Key: `oldies-goodies-wallingford` · OSM: `none (not from OSM)` · Status: **unknown** · verified=false.

- [ ] Open/current location: 68 1/2 Quinnipiac Street, Wallingford, CT 06492.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 203-317-0677.
- [ ] Official website/social identity: not established.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Music trade directory and individual business listing describe vinyl stock, but current operation not independently established; do not activate from this older lead. Sources: https://www.goldminemag.com/collector-resources/record-store-directory; https://www.yellowpages.com/wallingford-ct/mip/oldies-goodies-22098331. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 68 1/2 QUINNIPIAC ST, WALLINGFORD, CT, 06492.

### Paul's Boutique Records — Vernon

Key: `paul-s-boutique-records` · OSM: `node/13613579284` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Patch 2025-08-20: owner said the shop "is shutting its doors and going virtual"; 50% off sale at 630 Talcottville Road until the move. Bobcat Prowl 2023 confirms it sold vinyl. Storefront closure date not confirmed. User-confirmed 2026-10-26: physical storefront at 630 Talcottville Road permanently closed at the end of August 2025; business continues online/live-stream sales (sources supplied by user: ctinsider.com/business/article/pauls-boutique-records-vernon-ct-closing-20824071.php; fox61.com Vernon record shop live-stream sales article). Not a physical shop; keep inactive.

### Progressive music — town unconfirmed

Key: `progressive-music` · OSM: `node/4121678592` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Google Maps listing checked 2026-10-26: "Progressive Music CT", 260 Old Gate Ln, Milford (listed phone +1 203 444 1262, differs from OSM); a music lesson school, reviews are about lessons. Not a record shop. OSM location/phone appear outdated.

### Redscroll Records — Wallingford

Key: `redscroll-records` · OSM: `node/6249138252` · Status: **possibly closed** · verified=false.

Excluded from the verified record-shop directory: possibly closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Likely the former downtown location (24 North Colony Rd per Daily Nutmeg, 2014). Own site now says "We are on South Turnpike Road". Duplicate of redscroll-records-wallingford; keep inactive.

### Replay Records — Hamden

Key: `replay-records-hamden` · OSM: `none (not from OSM)` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site explicitly states Whitney Avenue storefront permanently closed August 2025; now online only. Retain inactive so stale directories do not reintroduce it. Sources: https://replayrecords.org/; https://www.goldminemag.com/collector-resources/record-store-directory. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 2586 WHITNEY AVE, HAMDEN, CT, 06518.

### Retro Spin Shop — Monroe

Key: `retro-spin-shop-monroe` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 446 Main Street, Suite B, Monroe, CT 06468.
- [ ] Sells vinyl records.
- [ ] Current hours: Tu-Su 11:00-18:00.
- [ ] Current phone: 203-220-8333.
- [ ] Official website/social identity: https://retrospinshop.com/.
- [ ] Confirm Discogs seller and seller-profile location: **RetroSpinShop**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site confirms records and links Discogs user RetroSpinShop under Visit my Discogs page; seller/profile activity and location still require confirmation. Sources: https://retrospinshop.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 446 MAIN ST, MONROE, CT, 06468.

### Revolution Records — Torrington

Key: `revolution-records-torrington` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 7 Willow Street, Torrington, CT 06790.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 860-618-5370.
- [ ] Official website/social identity: https://www.therevct.com/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. 2025 local newspaper owner interview confirms vinyl shop; individual listing supplies current contact and domain. Distinct from UK Revolution Records. Sources: https://www.therevct.com/; https://lakevillejournal.com/revolution-records-where-the-past-plays-on; https://recordstore.com/store/revolution-records-torrington-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 7 WILLOW ST, TORRINGTON, CT, 06790.

### River Bottom Records — Putnam

Key: `river-bottom-records-putnam` · OSM: `none (not from OSM)` · Status: **possibly closed** · verified=false.

Excluded from the verified record-shop directory: possibly closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Individual vinyl directory marks permanently closed; independent/current confirmation absent. Retain inactive rather than assert confirmed closure. Sources: https://www.vinylworld.org/record-shop/river-bottom-records-putnam-connecticut-united-states/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 112 MAIN ST, PUTNAM, CT, 06260.

### Rodeo Records — New Haven

Key: `rodeo-records-new-haven` · OSM: `node/470733881` · Status: **unknown** · verified=false.

Excluded from the verified record-shop directory: unknown. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Google Maps listing checked 2026-10-26: 335 Grand Ave is "Rodeo Groceries", a grocery store (matches the OSM shop=greengrocer tag). Not a record shop; OSM name is wrong. Keep out of the app.

### Sam Ash Music Store — New Haven

Key: `sam-ash-music-store-new-haven` · OSM: `node/7270851418` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Patch 2024-03-05: store expected to close late May 2024. Sam Ash liquidated all stores by July 2024 (Wikipedia). Instrument retailer.

### Semilla Cafe + Studio — Hartford

Key: `semilla-cafe-studio-hartford` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 1283 Main Street, Hartford, CT 06103.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: not established.
- [ ] Official website/social identity: not established.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Event co-organizer reports a permanent vinyl section at cafe in 2024; 2026 local reporting confirms cafe address. Verify ongoing record sales, phone/hours and official site. Sources: https://www.cafeteria.fm/home/semilla-cafe-opens-a-record-store; https://www.reportinghartford.com/post/inside-semilla-cafe-studio-hartford-s-neighborhood-living-room. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 1283 MAIN ST, HARTFORD, CT, 06103.

### Shaboo Productions — Willimantic

Key: `shaboo-productions-willimantic` · OSM: `way/886868896` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Own website describes instruments/lessons/rentals; CT Public 2022 describes an instrument and memorabilia warehouse plus production work. Not a record shop.

### Song-a-Day Music — Coventry

Key: `song-a-day-music` · OSM: `node/7393820268` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: PlayGuitar.com listing: music center offering lessons, instrument rentals and repair. No records mentioned.

### Static Era Records — Milford

Key: `static-era-records-milford` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 43 River Street, Milford, CT 06460.
- [ ] Sells vinyl records.
- [ ] Current hours: We-Sa 12:00-18:00; Tu by appointment.
- [ ] Current phone: 475-444-3663.
- [ ] Official website/social identity: https://staticerarecords.com/.
- [ ] Confirm Discogs seller and seller-profile location: **StaticEraRecords**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own retail page confirms vinyl, RSD participation, address/hours and links seller StaticEraRecords. Phone from music-trade listing; confirm directly. Sources: https://staticerarecords.com/; https://staticerarecords.com/pages/milford-connecticut; https://www.goldminemag.com/collector-resources/record-store-directory. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 43 RIVER ST, MILFORD, CT, 06460.

### Telegraph Autonomous Zone — New London

Key: `telegraph-autonomous-zone-new-london` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 137 Bank Street, New London, CT 06320.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 860-701-0506.
- [ ] Official website/social identity: https://telegraphnl.com/.
- [ ] Confirm Discogs seller and seller-profile location: **TelegraphNL**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site links seller TelegraphNL. Business LinkedIn profile confirms current 137 Bank Street; 19 Golden Street is former location, not another branch. Phone from individual directory; confirm directly. Sources: https://telegraphnl.com/; https://www.linkedin.com/company/telegraph-new-london; https://www.loc8nearme.com/connecticut/new-london/the-telegraph/2942742/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 137 BANK ST, NEW LONDON, CT, 06320.

### The Archive — Bridgeport

Key: `the-archive-bridgeport` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 118 Congress Street, Bridgeport, CT 06604.
- [ ] Sells vinyl records.
- [ ] Current hours: Tu-Su 11:00-18:00.
- [ ] Current phone: 203-441-5678.
- [ ] Official website/social identity: https://www.instagram.com/thearchivect/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Bridgeport Art Trail identifies official social account and describes physical store with vinyl LPs and soundtrack records. Sources: https://www.instagram.com/thearchivect/; https://bridgeportarttrail.org/the-archive. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 118 CONGRESS ST, BRIDGEPORT, CT, 06604.

### The Music Bureau — Salem

Key: `the-music-bureau` · OSM: `node/12536179401` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Listing describes music lessons (piano, sax, guitar, violin, voice). No records mentioned.

### The Nevermind Shop — Burlington

Key: `the-nevermind-shop-burlington` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 292 Spielman Highway, Burlington, CT 06013.
- [ ] Sells vinyl records.
- [ ] Current hours: Mo-We 11:00-17:00; Th-Sa 11:00-18:00; Su 11:00-17:00.
- [ ] Current phone: 860-777-2610.
- [ ] Official website/social identity: https://nevermindshop.com/.
- [ ] Confirm Discogs seller and seller-profile location: **nevermindshop**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site describes Connecticut vinyl shop and labels seller link Discogs (CT); nevermindupton is its Massachusetts branch and excluded. Sources: https://nevermindshop.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 292 SPIELMAN HWY, BURLINGTON, CT, 06013.

### Tracy's Tunes — Colchester

Key: `tracy-s-tunes` · OSM: `node/11851522753` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): User-confirmed 2026-10-26: music lessons, does not sell vinyl. Colchester.

### Trading Post Music & Video — Canton

Key: `trading-post-music-video-canton` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 233 Albany Turnpike, Canton, CT 06019.
- [ ] Sells vinyl records.
- [ ] Current hours: Mo-Sa 10:00-20:00; Su 11:00-19:00.
- [ ] Current phone: 860-693-4679.
- [ ] Official website/social identity: https://www.tradingpostmusic.com/.
- [ ] Confirm Discogs seller and seller-profile location: **tradingpostmusic**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site describes record-store affiliation and links Discogs seller tradingpostmusic; mixed music/instrument/gift shop, verify current physical vinyl selection. Sources: https://www.tradingpostmusic.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 233 ALBANY TPKE, CANTON, CT, 06019.

### Uncle Joe's Records — Cromwell

Key: `uncle-joe-s-records-cromwell` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 6 Kirby Road, Cromwell, CT 06416.
- [ ] Sells vinyl records.
- [ ] Current hours: not established.
- [ ] Current phone: 860-316-3631.
- [ ] Official website/social identity: https://www.unclejoesrecords.com/.
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site confirms vinyl sales, storefront and phone; no proven seller link found. Sources: https://www.unclejoesrecords.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 6 KIRBY RD, CROMWELL, CT, 06416.

### Vernon Vintage Vinyl — town unconfirmed

Key: `vernon-vintage-vinyl` · OSM: `node/13613579285` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): User-confirmed 2026-10-26: permanently closed. Same coordinates as Paul's Boutique Records (adjacent OSM node IDs). Keep inactive.

### Vinyl Street Co. — Fairfield

Key: `vinyl-street-co-fairfield` · OSM: `none (not from OSM)` · Status: **record shop** · verified=false.

- [ ] Open/current location: 1895c Post Road, Fairfield, CT 06824.
- [ ] Sells vinyl records.
- [ ] Current hours: We-Sa 12:00-18:00; Su 12:00-17:00.
- [ ] Current phone: 203-292-5785.
- [ ] Official website/social identity: https://www.vinylstreetco.com/.
- [ ] Confirm Discogs seller and seller-profile location: **VinylStreetCo.**.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Formerly Vinyl Street Cafe, same address; one shop, not two. Own site explicitly links its current Discogs seller VinylStreetCo.; legacy vinylstreetcafe also linked; confirm preferred account. Sources: https://www.vinylstreetco.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 1895C POST RD, FAIRFIELD, CT, 06824.
