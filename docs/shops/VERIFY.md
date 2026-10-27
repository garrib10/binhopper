# Verify the Connecticut shop directory

The authoritative CSV contains **46 rows: 25 verified and 21 unverified**.
The 20-row user research supplied on **2026-10-26** is settled. Existing shop keys
and OSM IDs are preserved; the four requested permanent closures and Census
coordinates for Records The Good Kind are explicit amendments. The 26 newly
researched candidates started as `verified=false`, even when a shop links its seller.

**Verification batch 1 (research 2026-10-26, #47):** the 22 unverified `record shop`
rows were checked against the shop's own site/social and business listings found
through web search. 8 were verified; the other 14 stay `verified=false` with the
missing evidence and one **Human check** question in their checklist. Discogs seller
profiles were read through the public `api.discogs.com/users/<name>` endpoint,
because the seller pages returned HTTP 403 to the fetcher. Closed, possibly closed,
unknown, instruments-only and previously verified rows were not changed.

**Verification batch 2 (user checks and research 2026-10-27, #47):** the user answered the
batch-1 questions. 12 more rows were verified, bringing the total to 25 verified shops,
18 of them with a Discogs seller. Little Lost Records is now `closed`, because its storefront
closed and the business is online-only as Odd Cabinet. Semilla Cafe is `unknown` and
`verified=false`, because it is a cafe that doesn't sell vinyl. Seller fields changed for
Retro Spin (restored) and Merle's (accepted by user judgment), and the websites for
Johnny's (parked domain) and Revolution (unconfirmed redirect) were cleared. Owner names
in earlier notes were removed, because the directory doesn't record private individuals'
names. Online-only sellers are listed in
[data/shops/README.md](../../data/shops/README.md) and must not be re-added as shops.

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
- [x] Confirm Discogs seller: **MerlesRecordRack** — accepted by user judgment 2026-10-27 (name match, US seller since 2019; profile shows no address or phone; re-check if listings look wrong).

Evidence / sources (research 2026-10-26 and 2026-10-27): Web research 2026-10-26: OSM name misspelled ("Merlin's"); same business at these coordinates. Address/phone/website per Patch listing (2022) and Closo registry (checked 2026-10-01, from map listing); hours from Closo only. Sells new and used LPs, CDs, cassettes (Orange Times, 2022-08-05). No Discogs seller established. User confirmed 2026-10-26 from the Google listing: record store, vinyl and CDs plus vintage audio and repair; 307 Racebrook Rd, Orange CT 06477; (203) 795-9033; hours Wed-Fri 10-3, Sat 10-4, closed Sun-Tue (matches). Likely Discogs seller: MerlesRecordRack (name match only; profile shows no address or phone; unconfirmed, field left blank). research 2026-10-27 (batch 2, user check): Discogs MerlesRecordRack accepted by user judgment: exact match on the shop's distinctive name, US seller, active since 2019 (~330 items); profile https://www.discogs.com/seller/MerlesRecordRack/profile shows no address or phone. Re-check if its listings ever look wrong.

### Records - The Good Kind — Vernon

Key: `records-the-good-kind-vernon` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 435 Hartford Turnpike — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: Mo off; Tu 12:00-17:00; We 12:00-18:00; Th-Sa 12:00-19:00; Su 12:00-17:00 — user research, 2026-10-26.
- [x] Current phone: +1 860 872 5506 — user research, 2026-10-26.
- [x] Official website/social identity: http://recordsthegoodkind.com — user research, 2026-10-26.
- [x] Confirm Discogs seller and seller-profile location: **lostsocks** — user research, 2026-10-26.

Evidence / sources (research 2026-10-26): Not from OSM. Found 2026-10-26 via Google Maps listing (147 reviews; recent reviews describe a used-record shop with graded and bargain vinyl, visited Oct 2025); also listed on Giftly (giftly.com/gift-card/records-the-good-kind-vernon). Needs lat/lng from a permitted source (e.g. US Census geocoder) before loading. User confirmed 2026-10-26 from the Google listing: record store (vinyl LPs, CDs, cassettes), located in Shops At 30, 435 Hartford Turnpike, Vernon CT 06066; (860) 872-5506; hours match. Still needs lat/lng before it can load. Discogs seller lostsocks (found by user 2026-10-26): business seller profile shows Records The Good Kind, 435Q Hartford Tpke, Vernon CT, phone 8608725506, matching this shop (unit Q). About 86 items for sale. Website recordsthegoodkind.com per Redscroll's 2023 record fair vendor list (owner named; name omitted). coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 435 HARTFORD TPKE, VERNON, CT, 06066.

### Redscroll Records — Wallingford

Key: `redscroll-records-wallingford` · OSM: `node/12609227301` · Status: **record shop** · verified=true.

- [x] Open/current location: 69 South Turnpike Road, Unit B — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: Mo-Th 11:00-18:00, Fr-Sa 11:00-19:00, Su 11:00-17:00 — user research, 2026-10-26.
- [x] Current phone: (203) 265-7013 — user research, 2026-10-26.
- [x] Official website/social identity: https://redscrollrecords.com/ — user research, 2026-10-26.
- [x] Confirm Discogs seller and seller-profile location: **Redscroll** — user research, 2026-10-26.

Evidence / sources (research 2026-10-26 and 2026-10-27): Web research 2026-10-26: Own site (redscrollrecords.com/marketing-menu) lists 69 South Turnpike Road Unit B, Wallingford CT 06492, these hours, and links discogs.com/seller/Redscroll. Phone matches own contact page and Closo registry (checked 2026-10-01). Current location; node/6249138252 is the former downtown location. research 2026-10-27 (batch 2, user check): Discogs record store page https://www.discogs.com/record-stores/store/redscroll/ added as a source.

### Tumbleweeds Music & More — Niantic

Key: `tumbleweeds-music-more` · OSM: `node/8169569417` · Status: **record shop** · verified=true.

- [x] Open/current location: 325 Main Street, Suite 1 — user research, 2026-10-26.
- [x] Sells vinyl records — user research, 2026-10-26.
- [x] Current hours: Mo-Th 10:00-18:00; Fr-Sa 10:00-19:00; Su 11:00-18:00 — user research, 2026-10-26.
- [x] Current phone: +1 860 739 9018 — user research, 2026-10-26.
- [x] Official website/social identity: https://tumbleweedsct.com — user research, 2026-10-26.
- [x] Confirm Discogs seller and seller-profile location: **tumbleweedsgirl** — user research, 2026-10-26.

Evidence / sources (research 2026-10-26): Verified 2026-10-26 at user's direction from the Google Maps listing (Tumbleweeds, 325 Main St, Niantic CT 06357; 226 reviews; recent reviews mention vinyl, CDs, restored stereos and the owner). Listing location matches this OSM node; owner matches the Women in Vinyl profile (owner name omitted; new and used vinyl, CDs, tapes; tumbleweedsct.com, @tumbleweedsct). Second overflow location not listed separately. No Discogs seller established. Discogs seller tumbleweedsgirl (found by user 2026-10-26): business seller profile lists Tumbleweeds, 325 Main St Ste 1, Niantic CT, phone 860-739-9018, matching this shop; listings mention pickup in Niantic. About 9,100 items for sale.

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

Key: `cbug-s-records-east-windsor` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 42 Bridge Street, second floor, East Windsor, CT 06088 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Tu-Sa 10:00-17:00; Su 12:00-17:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 860-519-4725 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.cbugsrecords.com/ — research 2026-10-26 (batch 1).
- [x] Discogs seller: none (field blank; see notes) — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site confirms vinyl shop on second floor of The Vintage Shops; Monday unspecified. Sources: https://www.cbugsrecords.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 42 BRIDGE ST, EAST WINDSOR, CT, 06088. research 2026-10-26 (verify batch 1): VERIFIED. Open: official Instagram https://www.instagram.com/cbugsrecords/ posts 2026-08-18 to 2026-09-15 (bio links cbugsrecords.com); Yelp https://www.yelp.com/biz/cbugs-records-east-windsor (updated May 2026, not closed); RSD store page https://recordstoreday.com/Store/23757. Vinyl: own site https://www.cbugsrecords.com/ "Vinyl records and memorabilia". Address/phone/hours confirmed on own site; Yelp lists Sunday 10-5, own site Sunday 12-5 (own site used). Discogs: no seller link on site or social; none found. research 2026-10-27 (batch 2, user check): Discogs seller stays blank: former account cbugsrecords (https://www.discogs.com/user/cbugsrecords) is closed; do not re-add.

### Clocktower Records — Thomaston

Key: `clocktower-records-thomaston` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 135 South Main Street, Tower 2nd Floor — user check 2026-10-27.
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Th 12:00-17:00; Fr 14:00-19:00; Sa 11:00-16:00; Su 11:00-15:00; Mo-We off — user check 2026-10-27.
- [x] Current phone: 860-463-3092 — user check 2026-10-27.
- [x] Official website/social identity: https://www.clocktowerrecords.net/ — user check 2026-10-27.
- [x] Discogs seller: none (field blank; see notes) — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site describes family vinyl store; certificate could not be validated in local client, so no insecure TLS bypass. Newspaper 2025-10-18 confirms opening and phone; weekend hours vary, confirm current schedule. Sources: https://www.clocktowerrecords.net/; https://www.thehour.com/waterbury/article/thomaston-clocktower-records-vinyl-21100193.php. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; no Connecticut match; left blank. research 2026-10-26 (verify batch 1): NOT VERIFIED: phone and hours conflict. Web search reports own site and Yelp https://www.yelp.com/biz/clocktower-records-thomaston (updated Jul 2026) give (860) 605-3918; the 2025-10-18 newspaper gives 860-463-3092 (current row value). Hours: site/Facebook reportedly Sat 11-4, Sun 11-3; Yelp Sat-Sun 11-3. Own site https://www.clocktowerrecords.net/ still fails TLS validation (unable to get local issuer certificate), not bypassed, so its text was not read directly; this is not closure evidence. Official Facebook https://www.facebook.com/p/Clocktower-Records-61575759822586/ not readable. Discogs: none found. coordinates: US Census geocoder Public_AR_Census2020 benchmark, 2026-10-26; matched 135 S MAIN ST, THOMASTON, CT, 06787 (Public_AR_Current matched 135 MAIN ST, a different street, rejected). research 2026-10-27 (batch 2, user check): VERIFIED. Address and hours user-confirmed. No Discogs seller: the only Discogs "Clocktower" match is an unrelated record label. Phone not re-checked in this pass: row keeps 860-463-3092 (2025-10-18 newspaper); listings give (860) 605-3918.

### Dexter's Tunes, Tales, and Ales — East Hampton

Key: `dexter-s-tunes-tales-and-ales-east-hampton` · OSM: `node/8975748838` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Used books and records with beer/wine (East Hampton town filing, 2019). Patch 2026-02-09: last day of business March 31, 2026.

### Disc & Dat — Bethel

Key: `disc-dat-bethel` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 107 Greenwood Avenue, Bethel, CT 06801 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Fr 11:00-19:00; Sa 11:00-18:00; Su 11:00-17:00 — user check 2026-10-27.
- [x] Current phone: 203-797-0067 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.instagram.com/discanddat/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **discanddatsales** — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Local owner interview describes physical record shop and gives address/phone; official social linked by individual directory. Current hours not directly established. Sources: https://www.instagram.com/discanddat/; https://www.bethelgrapevine.com/articles/national-record-store-day-go-check-out-bethels-disc-dat; https://recordstore.com/store/disc-dat-bethel-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 107 GREENWOOD AVE, BETHEL, CT, 06801. research 2026-10-26 (verify batch 1): NOT VERIFIED: hours conflict. Official Instagram https://www.instagram.com/discanddat/ (used CDs, vinyl, cassettes) posts 2026-10-13 to 2026-10-26, no hours; listings disagree on weekends (Discogs store page Sat/Sun 11-7; https://recordstore.com/store/disc-dat-bethel-ct and spindig Sat 11-6, Sun 11-5). Address/phone (203) 797-0067 consistent (RSD https://recordstoreday.com/Store/15806). Discogs: record-store page names discanddatsale, which no longer exists (API 404); user discanddat is empty (registered 2026-09, marketplace suspended); neither accepted. research 2026-10-27 (batch 2, user check): VERIFIED. Hours user-confirmed. Discogs discanddatsales user-confirmed: record store page https://www.discogs.com/record-stores/store/discanddatsale/ links seller https://www.discogs.com/seller/discanddatsales/profile, whose profile shows 107 Greenwood Avenue, Bethel, CT 06801. Replaces the dead/suspended accounts noted earlier (discanddatsale, discanddat).

### E.V. Music Ship — Bridgeport

Key: `e-v-music-ship-bridgeport` · OSM: `node/3470315892` · Status: **unknown** · verified=false.

Excluded from the verified record-shop directory: unknown. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Google Maps listing checked 2026-10-26: "EV MUSIC SHOP", 2381 Main St; categorized as cell phone/electronics store; reviews mention computers, wireless, IPTV and music generally. No evidence of vinyl. HomeGuide: CDs, duplication, computer repair.

### Exile on Main Street — Branford

Key: `exile-on-main-street-branford` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 267 East Main Street, Branford, CT 06405 — user check 2026-10-27.
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Fr 10:00-18:00; Sa 10:00-16:00; Su 11:00-16:00 — user check 2026-10-27.
- [x] Current phone: 203-483-6228 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://exileonmain.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **ashlee470** — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Connecticut Public reporting interviews vinyl-shop owners; individual directory supplies address/contact and official domain. Confirm current hours. Sources: https://exileonmain.com/; https://www.vermontpublic.org/2023-01-30/vinyl-album-sales-keep-rising-as-ct-customers-seek-warm-authentic-sounds-of-favorite-record; https://recordstore.com/store/exile-on-main-st-branford-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 267 E MAIN ST, BRANFORD, CT, 06405. research 2026-10-26 (verify batch 1): NOT VERIFIED: no shop-specific evidence of operation dated in the last 12 months. Own About page https://exileonmain.com/CustomPage/1082 gives hours (entered), 267 East Main St, (203) 483-6228; its dated "OUT THIS WEEK 10.23.26" homepage block is a syndicated vendor feed (identical on telegraphnl.com), not used. Instagram exileonmainst is private; no recent dated listing found (Vinylmapper agrees on Su 11-4). Discogs: record-store page https://www.discogs.com/record-stores/store/ashlee470/ names ashlee470, whose profile is empty (no name/address/phone); ExileonMain also empty. Likely seller (unconfirmed): neither entered. research 2026-10-27 (batch 2, user check): VERIFIED with hours/phone as in the row (user-confirmed). Discogs ashlee470 user-confirmed: Discogs' record store directory links Exile on Main Street to https://www.discogs.com/record-stores/store/ashlee470/.

### Full Haus Records — Norwalk

Key: `full-haus-records-norwalk` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 16 Knight Street, Norwalk, CT 06851 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Th-Fr 12:00-17:00; Sa-Su 12:00-19:00 — user check 2026-10-27.
- [x] Current phone: 475-470-8445 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://fullhausrecords.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **Fullhausrecords** — research 2026-10-26 (batch 1).

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site sells vinyl and provides storefront/contact/hours. Sources: https://fullhausrecords.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; no Connecticut match; left blank. research 2026-10-26 (verify batch 1): NOT VERIFIED: hours conflict. Own site https://fullhausrecords.com/ says Thurs-Fri 12-5, Sat-Sun 12-7; official Instagram https://www.instagram.com/fullhausrecords/ bio says "Mon-Tues Closed, Wed-..." (implies Wednesday opening); Discogs profile says "T-F 12pm-5pm S-S 12pm-7pm". Open: Instagram posts 2026-09-16 to 2026-10-07; Yelp https://www.yelp.com/biz/full-haus-records-norwalk (updated Sep 2026); Visit Norwalk https://www.visitnorwalk.org/directory/full-haus-records/. Address/phone 475-470-8445 on own site. Discogs Fullhausrecords CONFIRMED (found via web search, not on own site): Discogs profile read via https://api.discogs.com/users/Fullhausrecords (seller page https://www.discogs.com/seller/Fullhausrecords/profile returned HTTP 403 to the fetcher); name "Full Haus Records", profile "Visit our Store @ 16 Knight St. Norwalk, CT 06851". coordinates: US Census geocoder Public_AR_Census2020 benchmark, 2026-10-26; matched 16 KNIGHT ST, NORWALK, CT, 06851 (Public_AR_Current still no match). research 2026-10-27 (batch 2, user check): VERIFIED using the shop's own site https://fullhausrecords.com/ for address, phone and hours. Google and recordshops.net list 2 Brook St (likely the parking-lot entrance near Wall Street) and other hours; own site, Discogs profile https://www.discogs.com/seller/Fullhausrecords/profile and Visit Norwalk https://www.visitnorwalk.org/directory/full-haus-records/ agree on Knight St.

### Gerosa Records — Brookfield

Key: `gerosa-records-brookfield` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 246 Federal Road, Brookfield, CT — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: We-Sa 10:00-18:00; Su 11:00-17:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 203-775-7074 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://gerosarecords.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **gerosarecords** — research 2026-10-26 (batch 1).

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site confirms new/used vinyl, hours and contact. Dedicated online stores page explicitly links seller gerosarecords. Sources: https://gerosarecords.com/; https://gerosarecords.com/gerosa-records-ebay-discogs/; https://gerosarecords.com/contact/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 246 FEDERAL RD, BROOKFIELD, CT, 06804. research 2026-10-26 (verify batch 1): VERIFIED. Open: official Instagram https://www.instagram.com/gerosarecords/ posts 2026-10-22 to 2026-10-25, bio phone 203-775-7074, open Wed-Sun; Yellow Pages https://www.yellowpages.com/brookfield-ct/mip/gerosa-records-458084768 and https://www.vinylworld.org/record-shop/gerosa-records/ list 246 Federal Rd. Vinyl/address/phone/hours confirmed on own site https://gerosarecords.com/ (We-Sa 10-6, Su 11-5, Mo-Tu closed). Yellow Pages hours (Tu-Su incl. Sunday to midnight) conflict and look stale; own site + Discogs used. Discogs gerosarecords CONFIRMED: Discogs profile read via https://api.discogs.com/users/gerosarecords (seller page https://www.discogs.com/seller/gerosarecords/profile returned HTTP 403 to the fetcher); name "Gerosa Records", location "246 Federal Road C-16 Brookfield, CT 06804", phone 203-775-7074. research 2026-10-27 (batch 2, user check): Discogs gerosarecords kept; record store page https://www.discogs.com/record-stores/store/gerosarecords/ added as a source.

### Goldie & Libro Music Center — North Haven

Key: `goldie-libro-music-center-north-haven` · OSM: `node/5628062695` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): OSM shop=music alone does not establish vinyl sales. Own-site check 2026-10-26 UTC: https://goldielibro.com/. Own website describes instruments/lessons/rentals; vinyl sales not established. Own-site check 2026-10-26 UTC: https://goldielibro.com/about. Own website describes instruments/lessons/rentals; vinyl sales not established.

### GRAILS — New Haven

Key: `grails-new-haven` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 1020 Chapel Street, lower level, New Haven, CT 06510 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Sa 11:00-19:00; Su off — user check 2026-10-27.
- [x] Current phone: none published (field blank) — user check 2026-10-27.
- [x] Official website/social identity: https://www.grailsonchapel.com/ — research 2026-10-26 (batch 1).
- [x] Discogs seller: none (field blank; see notes) — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site describes rare original vinyl and reissues. Sunday hours and phone not established. Sources: https://www.grailsonchapel.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 1020 CHAPEL ST, NEW HAVEN, CT, 06510. research 2026-10-26 (verify batch 1): NOT VERIFIED: no public phone number found (own site, Instagram and search give none). Open: own Instagram https://www.instagram.com/grailsonchapel/ posts 2025-10-24 to 2026-10-20 (bio Mon-Sat 11a-7p); Yelp https://www.yelp.com/biz/grails-new-haven (updated Aug 2026); New Haven Independent 2025-10-22 https://www.newhavenindependent.org/2025/10/22/grails-put-your-records-on/. Vinyl/address/hours confirmed on own site https://www.grailsonchapel.com/ (Mon-Sat 11-7; Yelp says closed Sunday). Email info@grailsonchapel.com. Discogs: no link on site/social. research 2026-10-27 (batch 2, user check): VERIFIED. Hours Mo-Sa 11-7, Sunday closed (own site https://www.grailsonchapel.com/ and https://www.instagram.com/grailsonchapel/). No phone published; field left blank. No Discogs seller: none linked on own site/social (user-checked).

### Johnny's Records — Darien

Key: `johnny-s-records-darien` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 45 Tokeneke Road, Darien, CT 06820 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Fr 10:00-18:00; Sa 10:30-18:00; Su 12:00-16:30 — user check 2026-10-27.
- [x] Current phone: 203-655-0157 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: no website (parked johnnysrecords.com cleared); identity via Record Store Day store page and official Facebook — user check 2026-10-27.
- [x] Discogs seller: none (field blank; see notes) — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own indexed site describes rare vinyl and 50th anniversary. Individual listing confirms address/phone; local client connection reset is not closure evidence. Hours need direct confirmation. Sources: https://johnnysrecords.com/; https://recordstore.com/store/johnny-s-records-darien-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 45 TOKENEKE RD, DARIEN, CT, 06820. research 2026-10-26 (verify batch 1): NOT VERIFIED: hours unconfirmed and website down. https://johnnysrecords.com/ and /contact.htm now show a domain-parking page (2026-10-26); not closure evidence. Open evidence: official Facebook https://www.facebook.com/johnnysrecordshop post late May 2026 (Memorial Day closure, seen via https://www.findglocal.com/US/Darien/190808310944602/Johnny's-Records); News 12 50th-anniversary piece https://newyork.news12.com/main-street-connecticut-showcasing-darien-johnnys-records (late 2025); Yelp https://www.yelp.com/biz/johnnys-darien (updated Sep 2025). Listings hours conflict (Yelp 7 PM weekday closings vs older site 10-6, Sat 10:30-6, Sun 12-4:30). Address/phone consistent across listings. Discogs: none found. research 2026-10-27 (batch 2, user check): VERIFIED. Hours user-confirmed. Website cleared: johnnysrecords.com is a parked domain (domain-parking page seen 2026-10-26), so it no longer identifies the shop. Independent Record Store Day store: https://recordstoreday.com/Store/3958. No Discogs seller.

### Litchfield Music Center — Litchfield

Key: `litchfield-music-center` · OSM: `node/8901822437` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Google Maps listing checked 2026-10-26: music lessons and piano showroom/tuning; reviews mention lessons and pianos, no records.

### Little Lost Records — Stafford Springs

Key: `little-lost-records-stafford-springs` · OSM: `none (not from OSM)` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed (storefront closed 2026; online-only as Discogs seller oddcabinet). Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.
- Do not re-add this business as an active shop; online-only sellers are listed in data/shops/README.md.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Local newspaper owner interview dated 2024-07-14 confirms physical vinyl store. Current hours, phone, official website and seller identity not established. Sources: https://www.staffordfreepress.com/post/little-lost-records-celebrates-a-year-in-business. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 83 MAIN ST, STAFFORD SPRINGS, CT, 06076. research 2026-10-26 (verify batch 1): NOT VERIFIED: no official website or readable social found; phone and hours from listings only and hours conflict (Roadtrippers/Yelp Wed-Sun 11-6; Discogs Thu-Sun). Third-party evidence of operation: Shazam event 2026-03-28 https://www.shazam.com/event/5181980d-449d-4f0e-ad5d-d43c05f48231; Yelp https://www.yelp.com/biz/little-lost-records-stafford-springs (updated Dec 2025); RSD https://recordstoreday.com/Store/25852. Listing phone 860-480-8593 (unconfirmed, not entered). Discogs LittleLostRecordsCT appears in search results but the account no longer exists (API 404); not entered. research 2026-10-27 (batch 2, user check): CLOSED storefront, user-confirmed: renamed Odd Cabinet Records; 83 Main St storefront closed (Stafford Free Press 2026-09-24, "For Rent" sign). Now online only as Discogs seller oddcabinet (https://www.discogs.com/seller/oddcabinet/profile); seller field left blank. Do not add Odd Cabinet as a separate shop; see data/shops/README.md online-only sellers.

### Music Outlet — Enfield

Key: `music-outlet-enfield` · OSM: `none (not from OSM)` · Status: **possibly closed** · verified=false.

Excluded from the verified record-shop directory: possibly closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. 2023 local news reports closing sale; individual record directory now marks permanently closed. Confirm final closure if needed; retain inactive. Sources: https://patch.com/connecticut/enfield/music-institution-enfield-close-after-four-decades-business; https://www.vinylworld.org/record-shop/music-outlet/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 151 HAZARD AVE, ENFIELD, CT, 06082.

### Mystic Disc — Mystic

Key: `mystic-disc-mystic` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 10 Steamboat Wharf, Mystic, CT 06355 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Sa 11:00-18:00; Su 12:00-17:00 — user check 2026-10-27.
- [x] Current phone: 860-536-1312 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.instagram.com/mystic_disc/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **mystic_disc** — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Long-running physical vinyl shop; individual store profile identifies official social, address and phone. Avoid erroneous listings placing it in Waterbury. Sources: https://www.instagram.com/mystic_disc/; https://recordstore.com/store/mystic-disc-mystic-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 10 STEAMBOAT WHARF, MYSTIC, CT, 06355. research 2026-10-26 (verify batch 1): NOT VERIFIED: hours not on official social and listings conflict (weekdays 11-6; Sunday 12-5 on one listing, weekends omitted on Discogs). Open: official Instagram https://www.instagram.com/mystic_disc/ (bio phone 860-536-1312, "We buy and sell records New Used Rare Since 1983") posts 2026-09-19 to 2026-10-20; Yelp https://www.yelp.com/biz/mystic-disc-mystic (updated Aug 2026). Discogs: mystic_disc is the likely seller (unconfirmed): Discogs profile read via https://api.discogs.com/users/mystic_disc (seller page https://www.discogs.com/seller/mystic_disc/profile returned HTTP 403 to the fetcher) shows name "Mystic Disc", location "Mystic, CT", empty profile, no address/phone; not entered. research 2026-10-27 (batch 2, user check): VERIFIED. Hours user-confirmed. Discogs mystic_disc user-confirmed: record store page https://www.discogs.com/record-stores/store/mystic_disc/ (Groton/Mystic, CT; Mystic is a village split between Groton and Stonington, so "Groton" listings are the same shop) is owned by seller https://www.discogs.com/seller/mystic_disc/profile.

### Newbury Comics — Danbury

Key: `newbury-comics-danbury` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 7 Backus Avenue, Space B215, Danbury, CT 06810 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Th 10:00-20:00; Fr-Sa 10:00-21:00; Su 11:00-19:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 475-348-7561 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.newburycomics.com/pages/locations/ — research 2026-10-26 (batch 1).
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**; see notes for any likely seller.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Official chain locator confirms Danbury Fair branch/contact/hours; chain sells vinyl. Separate Manchester CT branch, not Manchester NH. Sources: https://www.newburycomics.com/pages/locations/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 7 BACKUS AVE, DANBURY, CT, 06810. research 2026-10-26 (verify batch 1): VERIFIED. Official chain locator https://www.newburycomics.com/pages/locations/ (fetched 2026-10-26) lists Danbury Fair Space B215, 7 Backus Ave, (475) 348-7561, Mo-Th 10-8, Fr-Sa 10-9, Su 11-7 (matches row); branch Instagram https://www.instagram.com/newburycomicsdanbury/ posts 2026-10-10 to 2026-10-26, bio mentions vinyl; https://www.mallscenters.com/brands/stores/newbury-comics/danbury--connecticut--danbury-fair lists the store. Chain site sells vinyl. Discogs: no location seller.

### Newbury Comics — Manchester

Key: `newbury-comics-manchester` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 194 Buckland Hills Drive, Manchester, CT 06040 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Th 10:00-20:00; Fr-Sa 10:00-21:00; Su 11:00-18:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 860-648-2411 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.newburycomics.com/pages/locations/ — research 2026-10-26 (batch 1).
- [ ] Confirm Discogs seller and seller-profile location: **not established (optional; leave blank until proven)**; see notes for any likely seller.

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Official chain locator confirms Shoppes at Buckland Hills branch/contact/hours; chain sells vinyl. No location-specific seller confirmed. Sources: https://www.newburycomics.com/pages/locations/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 194 BUCKLAND HILLS DR, MANCHESTER, CT, 06042. research 2026-10-26 (verify batch 1): VERIFIED. Official chain locator https://www.newburycomics.com/pages/locations/ (fetched 2026-10-26) lists The Shoppes at Buckland Hills, 194 Buckland Hills Drive, Manchester CT 06040, (860) 648-2411, Mo-Th 10-8, Fr-Sa 10-9, Su 11-6 (matches row); mall directory https://www.theshoppesatbucklandhills.com/directory lists Newbury Comics (fetched 2026-10-26). Chain site sells vinyl. Discogs: no location seller.

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

Excluded from the verified record-shop directory: closed (storefront closed August 2025; online-only as Discogs seller replayrecordsct). Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.
- Do not re-add this business as an active shop; online-only sellers are listed in data/shops/README.md.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site explicitly states Whitney Avenue storefront permanently closed August 2025; now online only. Retain inactive so stale directories do not reintroduce it. Sources: https://replayrecords.org/; https://www.goldminemag.com/collector-resources/record-store-directory. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 2586 WHITNEY AVE, HAMDEN, CT, 06518. research 2026-10-27 (batch 2, user check): Stays closed. Online-only seller replayrecordsct (https://www.discogs.com/record-stores/store/replayrecordsct/); seller field left blank. See data/shops/README.md online-only sellers.

### Retro Spin Shop — Monroe

Key: `retro-spin-shop-monroe` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 446 Main Street, Suite B, Monroe, CT 06468 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Tu-Su 11:00-18:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 203-220-8333 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://retrospinshop.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **RetroSpinShop** — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site confirms records and links Discogs user RetroSpinShop under Visit my Discogs page; seller/profile activity and location still require confirmation. Sources: https://retrospinshop.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 446 MAIN ST, MONROE, CT, 06468. research 2026-10-26 (verify batch 1): VERIFIED. Open: official Instagram https://www.instagram.com/retrospinshop/ ("Vinyl Record & Pop Culture Shop") posts 2026-07-24 to 2026-10-20; Monroe Chamber directory https://widgets.monroectchamber.com/feeds/directory/directory/action/Listing/value/1057/cid/1977/id/201/Retro-Spin-Shop and MapQuest https://www.mapquest.com/us/connecticut/retro-spin-shop-676185942 list 446 Main St Ste B, (203) 220-8333. Vinyl/address/phone/hours (Tu-Su 11-6, Mo closed) confirmed on own site https://retrospinshop.com/. Discogs CLEARED: Discogs profile read via https://api.discogs.com/users/RetroSpinShop (seller page https://www.discogs.com/seller/RetroSpinShop/profile returned HTTP 403 to the fetcher) shows name "RW", location "Connecticut", profile "Record Dude who resides in CT", no business name/address/phone. RetroSpinShop is the likely seller (unconfirmed) since the shop site links it. research 2026-10-27 (batch 2, user check): Discogs RetroSpinShop restored, user-confirmed: the shop's own website https://retrospinshop.com/ links https://www.discogs.com/user/RetroSpinShop. Overrides the 2026-10-26 clearing.

### Revolution Records — Torrington

Key: `revolution-records-torrington` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 7 Willow Street, Torrington, CT 06790 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo off; Tu-Sa 12:00-20:00; Su 10:00-14:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 860-618-5370 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: no confirmed website (therevct.com cleared, see notes); official Instagram https://www.instagram.com/therevct/ — user check 2026-10-27.
- [x] Discogs seller: none (field blank; see notes) — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. 2025 local newspaper owner interview confirms vinyl shop; individual listing supplies current contact and domain. Distinct from UK Revolution Records. Sources: https://www.therevct.com/; https://lakevillejournal.com/revolution-records-where-the-past-plays-on; https://recordstore.com/store/revolution-records-torrington-ct. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 7 WILLOW ST, TORRINGTON, CT, 06790. research 2026-10-26 (verify batch 1): VERIFIED. Open: official Instagram https://www.instagram.com/therevct/ posts 2026-10-15 to 2026-10-23, bio "7 Willow St, Torrington, CT ... Over 20,000 New & Used Vinyl"; Yelp https://www.yelp.com/biz/revolution-records-torrington-3 (updated Apr 2026, not closed). Own site/social give no phone or hours, so these come from listings, which agree: https://www.loc8nearme.com/connecticut/torrington/revolution-records/5638778/ and https://www.giftly.com/gift-card/revolution-records-torrington-3 both give (860) 618-5370 and Tu-Sa 12-8, Su 10-2, Mo closed. Note: therevct.com redirects (302) to https://lecher7.github.io/TheRevCT/index.html ("Revolution Records and Cards", links facebook.com/TheRevCT); website field left as is. Also sells trading cards. Discogs: no seller link found; therevct and revolutionrecordsct do not exist on Discogs. research 2026-10-27 (batch 2, user check): No Discogs seller (user-checked). Website cleared: therevct.com redirects to lecher7.github.io/TheRevCT, and the shop's Instagram https://www.instagram.com/therevct/ shows no website link (checked 2026-10-27); the Google listing was not checked (no Places API), so the page is not confirmed as the shop's.

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

Key: `semilla-cafe-studio-hartford` · OSM: `none (not from OSM)` · Status: **unknown** · verified=false.

Excluded from the verified record-shop directory: not a record shop (cafe and studio; does not sell vinyl, user-confirmed 2026-10-27). Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.
- Do not re-add this business as an active shop; online-only sellers are listed in data/shops/README.md.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Event co-organizer reports a permanent vinyl section at cafe in 2024; 2026 local reporting confirms cafe address. Verify ongoing record sales, phone/hours and official site. Sources: https://www.cafeteria.fm/home/semilla-cafe-opens-a-record-store; https://www.reportinghartford.com/post/inside-semilla-cafe-studio-hartford-s-neighborhood-living-room. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 1283 MAIN ST, HARTFORD, CT, 06103. research 2026-10-26 (verify batch 1): NOT VERIFIED: no evidence of record sales in the last 12 months. Cafe is open (official Instagram https://www.instagram.com/semillahtfd/ posts 2026-09-16 to 2026-10-24; Reporting Hartford 2026-05-27 article) but neither, nor own site https://semilla.cafe/, mentions records; record section evidence dates to 2024 (https://www.cafeteria.fm/home/semilla-cafe-opens-a-record-store). Listing phone (860) 263-7043 (https://www.chamberofcommerce.com/business-directory/connecticut/hartford/coffee-shop/2015996419-semilla-cafe-studio), unconfirmed, not entered. Website https://semilla.cafe/ found (not entered until record sales confirmed). Discogs: none. research 2026-10-27 (batch 2, user check): NOT A RECORD SHOP, user-confirmed: cafe and studio, does not sell vinyl. Do not re-add as a record shop.

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

Key: `static-era-records-milford` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 43 River Street, Milford, CT 06460 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: We-Sa 12:00-18:00; Tu by appointment — research 2026-10-26 (batch 1).
- [x] Current phone: 475-444-3663 — user check 2026-10-27.
- [x] Official website/social identity: https://staticerarecords.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **StaticEraRecords** — research 2026-10-26 (batch 1).

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own retail page confirms vinyl, RSD participation, address/hours and links seller StaticEraRecords. Phone from music-trade listing; confirm directly. Sources: https://staticerarecords.com/; https://staticerarecords.com/pages/milford-connecticut; https://www.goldminemag.com/collector-resources/record-store-directory. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 43 RIVER ST, MILFORD, CT, 06460. research 2026-10-26 (verify batch 1): NOT VERIFIED: phone unconfirmed. Own site https://staticerarecords.com/pages/milford-connecticut lists no phone; listings give (475) 444-3663 but label product pages show +1 (203) 435-1021. Open: retail Instagram https://www.instagram.com/staticeramilford/ posts 2026-09-24 to 2026-10-26; Yelp https://www.yelp.com/biz/static-era-records-milford (updated Oct 2026). Address and hours (We-Sa 12-6, Tu by appointment, Su-Mo closed) confirmed on own site. Discogs StaticEraRecords CONFIRMED: Discogs profile read via https://api.discogs.com/users/StaticEraRecords (seller page https://www.discogs.com/seller/StaticEraRecords/profile returned HTTP 403 to the fetcher); profile "Visit our retail store. 43 River Street, Milford, CT 06460". research 2026-10-27 (batch 2, user check): VERIFIED with row details as they stand (phone 475-444-3663 accepted by user). Discogs StaticEraRecords confirmed.

### Telegraph Autonomous Zone — New London

Key: `telegraph-autonomous-zone-new-london` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 137 Bank Street, New London, CT 06320 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Th 11:00-17:00; Fr 11:00-18:00; Sa 10:00-18:00; Su 10:00-16:00 — user check 2026-10-27.
- [x] Current phone: 860-701-0506 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://telegraphnl.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **TelegraphNL** — research 2026-10-26 (batch 1).

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site links seller TelegraphNL. Business LinkedIn profile confirms current 137 Bank Street; 19 Golden Street is former location, not another branch. Phone from individual directory; confirm directly. Sources: https://telegraphnl.com/; https://www.linkedin.com/company/telegraph-new-london; https://www.loc8nearme.com/connecticut/new-london/the-telegraph/2942742/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 137 BANK ST, NEW LONDON, CT, 06320. research 2026-10-26 (verify batch 1): NOT VERIFIED: hours conflict. Shop's Discogs profile says Mon-Fri 11-6 (Fri after hours 8-10), Sat 10-6, Sun 10-4; Chamber of Commerce https://www.chamberofcommerce.com/business-directory/connecticut/new-london/record-store/2002078471-telegraph-autonomous-zone and Mindtrip say 11-6 daily; own site/Instagram give none. Open: official Instagram https://www.instagram.com/telegraphnl/ ("indie record & book shop") posts 2026-09-10 to 2026-10-23; Giftly https://www.giftly.com/gift-card/telegraph-autonomous-zone-new-london lists 137 Bank St. (Own site's dated "OUT THIS WEEK" block is a syndicated vendor feed, not used as evidence.) Address/phone 860-701-0506 consistent. Discogs TelegraphNL CONFIRMED: Discogs profile read via https://api.discogs.com/users/TelegraphNL (seller page https://www.discogs.com/seller/TelegraphNL/profile returned HTTP 403 to the fetcher); name "Telegraph Autonomous Zone", profile gives 137 Bank Street New London 06320 and 860-701-0506. research 2026-10-27 (batch 2, user check): VERIFIED. Hours user-confirmed. Discogs TelegraphNL: own site https://telegraphnl.com/ links it; record store page https://www.discogs.com/record-stores/store/telegraphnl/.

### The Archive — Bridgeport

Key: `the-archive-bridgeport` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 118 Congress Street, Bridgeport, CT 06604 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo,Tu,Th-Su 11:00-18:00; We off — user check 2026-10-27.
- [x] Current phone: 203-441-5678 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.instagram.com/thearchivect/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **The_Archive_CT** — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Bridgeport Art Trail identifies official social account and describes physical store with vinyl LPs and soundtrack records. Sources: https://www.instagram.com/thearchivect/; https://bridgeportarttrail.org/the-archive. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 118 CONGRESS ST, BRIDGEPORT, CT, 06604. research 2026-10-26 (verify batch 1): NOT VERIFIED: closed day conflicts. Official Instagram https://www.instagram.com/thearchivect/ ("Brick & mortar film, music, & culture shop", hours 11am-6pm, days not stated) posts 2026-10-21 to 2026-10-26; Yelp https://www.yelp.com/biz/the-archive-bridgeport (updated Sep 2026) and https://www.chamberofcommerce.com/business-directory/connecticut/bridgeport/record-store/2016269781-the-archive list Wednesday closed; Vinylmapper and the shop's X account say Monday closed. Address/phone 203-441-5678 consistent across listings. Discogs: none found. research 2026-10-27 (batch 2, user check): VERIFIED. Wednesday closed per Google, Yelp and Chamber of Commerce listings. Discogs The_Archive_CT user-confirmed: https://www.discogs.com/seller/The_Archive_CT/profile shows The Archive, 118 Congress Street, Bridgeport CT 06604, IG @thearchiveCT; profile says "Daily 11:00-18:00" (account from 2019, likely stale, not used) and notes most stock is in-store only.

### The Music Bureau — Salem

Key: `the-music-bureau` · OSM: `node/12536179401` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): Web research 2026-10-26: Listing describes music lessons (piano, sax, guitar, violin, voice). No records mentioned.

### The Nevermind Shop — Burlington

Key: `the-nevermind-shop-burlington` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 292 Spielman Highway, Burlington, CT 06013 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-We 11:00-17:00; Th-Sa 11:00-18:00; Su 11:00-17:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 860-777-2610 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://nevermindshop.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **nevermindshop** — research 2026-10-26 (batch 1).

Evidence / sources (research 2026-10-26): not from OSM; researched 2026-10-26. Own site describes Connecticut vinyl shop and labels seller link Discogs (CT); nevermindupton is its Massachusetts branch and excluded. Sources: https://nevermindshop.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 292 SPIELMAN HWY, BURLINGTON, CT, 06013. research 2026-10-26 (verify batch 1): VERIFIED. Open: own site https://nevermindshop.com/ dated posts Nov 2025 to May 2026 (Burlington 1st anniversary 2025-11-01, Mondays added 2026-02-02, RSD 2026-04-18); Yelp https://www.yelp.com/biz/the-nevermind-shop-burlington (updated Jul 2026, not closed); Facebook https://www.facebook.com/thenevermindshop/. Vinyl: own site "over 20,000 records, both new and old". Address/phone/hours from own site; unclaimed Yelp hours (Tu-Sa 11-6, Su-Mo closed) conflict and are older; own site used. Discogs nevermindshop CONFIRMED: Discogs profile read via https://api.discogs.com/users/nevermindshop (seller page https://www.discogs.com/seller/nevermindshop/profile returned HTTP 403 to the fetcher); name "The Nevermind Shop", location Burlington, Connecticut, "record store in Burlington, CT".

### Tracy's Tunes — Colchester

Key: `tracy-s-tunes` · OSM: `node/11851522753` · Status: **instruments only** · verified=false.

Excluded from the verified record-shop directory: instruments only. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): User-confirmed 2026-10-26: music lessons, does not sell vinyl. Colchester.

### Trading Post Music & Video — Canton

Key: `trading-post-music-video-canton` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 233 Albany Turnpike, Canton, CT 06019 — user check 2026-10-27.
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Mo-Sa 10:00-20:00; Su 11:00-19:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 860-693-4679 — user check 2026-10-27.
- [x] Official website/social identity: https://www.tradingpostmusic.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **tradingpostmusic** — research 2026-10-26 (batch 1).

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site describes record-store affiliation and links Discogs seller tradingpostmusic; mixed music/instrument/gift shop, verify current physical vinyl selection. Sources: https://www.tradingpostmusic.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 233 ALBANY TPKE, CANTON, CT, 06019. research 2026-10-26 (verify batch 1): NOT VERIFIED: no dated evidence of operation in the last 12 months and phone conflict. Own site https://www.tradingpostmusic.com/ gives address, (860) 693-4679 and hours (matches row) but no dated posts; Yellow Pages lists (860) 264-1797; Yelp https://www.yelp.com/biz/trading-post-music-canton shows "Updated August 2026" only. instagram.com/tradingpostmusic is an unrelated band. Discogs tradingpostmusic CONFIRMED: Discogs profile read via https://api.discogs.com/users/tradingpostmusic (seller page https://www.discogs.com/seller/tradingpostmusic/profile returned HTTP 403 to the fetcher); profile "Trading Post Music is a retail store located in Canton, CT. USA opened in 1983. We carry LPs..." (4,410 items for sale). research 2026-10-27 (batch 2, user check): VERIFIED with row details as they stand (user-confirmed). Discogs tradingpostmusic confirmed.

### Uncle Joe's Records — Cromwell

Key: `uncle-joe-s-records-cromwell` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 6 Kirby Road, Cromwell, CT 06416 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: Tu 11:30-18:00; We 07:30-17:00; Th-Sa 07:30-18:00; Su 11:00-17:00; Mo off — user check 2026-10-27.
- [x] Current phone: 860-316-3631 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.unclejoesrecords.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **UncleJoesRecords** — user check 2026-10-27.

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Own site confirms vinyl sales, storefront and phone; no proven seller link found. Sources: https://www.unclejoesrecords.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 6 KIRBY RD, CROMWELL, CT, 06416. research 2026-10-26 (verify batch 1): NOT VERIFIED: weekly hours not fully established. Official Instagram https://www.instagram.com/uncle_joes_records/ shows Tue 11:30-6, Wed 7:30-5 (rest truncated) and posts 2026-08-29 to 2026-10-24; Yelp/Chamber add Thu-Sat 7:30-6, Mon closed; Apple Maps Sun 11-5; Vinylmapper conflicts (Mon 10-6, Sun 12-4). Open: Instagram above; Yelp https://www.yelp.com/biz/uncle-joes-records-cromwell (updated Aug 2026). Address/phone 860-316-3631 confirmed on own contact page https://www.unclejoesrecords.com/contact. Discogs: UncleJoesRecords is the likely seller (unconfirmed): Discogs profile read via https://api.discogs.com/users/UncleJoesRecords (seller page https://www.discogs.com/seller/UncleJoesRecords/profile returned HTTP 403 to the fetcher) shows name "Uncle Joe", location "Cromwell - Connecticut", home page UncleJoesRecords.com, but no address/phone; not entered. research 2026-10-27 (batch 2, user check): VERIFIED. Hours user-confirmed. Discogs UncleJoesRecords accepted: https://www.discogs.com/seller/UncleJoesRecords/profile links unclejoesrecords.com with location Cromwell, and Google reviews cite purchases via the shop's Discogs store.

### Vernon Vintage Vinyl — town unconfirmed

Key: `vernon-vintage-vinyl` · OSM: `node/13613579285` · Status: **closed** · verified=false.

Excluded from the verified record-shop directory: closed. Reason and provenance below.
- [ ] Reassess only if new evidence contradicts the documented closure, relocation or non-record-shop classification.

Evidence / sources (research 2026-10-26): User-confirmed 2026-10-26: permanently closed. Same coordinates as Paul's Boutique Records (adjacent OSM node IDs). Keep inactive.

### Vinyl Street Co. — Fairfield

Key: `vinyl-street-co-fairfield` · OSM: `none (not from OSM)` · Status: **record shop** · verified=true.

- [x] Open/current location: 1895c Post Road, Fairfield, CT 06824 — research 2026-10-26 (batch 1).
- [x] Sells vinyl records — research 2026-10-26 (batch 1).
- [x] Current hours: We-Sa 12:00-18:00; Su 12:00-17:00 — research 2026-10-26 (batch 1).
- [x] Current phone: 203-292-5785 — research 2026-10-26 (batch 1).
- [x] Official website/social identity: https://www.vinylstreetco.com/ — research 2026-10-26 (batch 1).
- [x] Confirm Discogs seller and seller-profile location: **VinylStreetCo.** — research 2026-10-26 (batch 1).

Evidence / sources (research 2026-10-26 and 2026-10-27): not from OSM; researched 2026-10-26. Formerly Vinyl Street Cafe, same address; one shop, not two. Own site explicitly links its current Discogs seller VinylStreetCo.; legacy vinylstreetcafe also linked; confirm preferred account. Sources: https://www.vinylstreetco.com/. Unverified candidate; confirm current business details and seller profile location before activation. coordinates: US Census geocoder, 2026-10-26; https://geocoding.geo.census.gov/geocoder/locations/onelineaddress; matched 1895C POST RD, FAIRFIELD, CT, 06824. research 2026-10-26 (verify batch 1): VERIFIED. Open: own Instagram https://www.instagram.com/vinylstreetcompany/ posts 2026-09-26 to 2026-10-23, bio gives 1895c Post Rd and Wed-Sat 12-6, Sun 12-5; Yelp listing https://www.yelp.com/biz/vinyl-street-fairfield-3 (updated Oct 2026, not marked closed); recordstore.com lists it. Vinyl: own site https://www.vinylstreetco.com/ "Still Your Local Independent Record Store", in-store inventory. Address/phone/hours confirmed on own site (Mo-Tu closed). Discogs VinylStreetCo. CONFIRMED: Discogs profile read via https://api.discogs.com/users/VinylStreetCo. (seller page https://www.discogs.com/seller/VinylStreetCo./profile returned HTTP 403 to the fetcher); profile text "Visit our brick & mortar shop: Vinyl Street Co. 1895c Post Road Fairfield, CT 06824". Legacy vinylstreetcafe account linked in site footer no longer exists (API 404). research 2026-10-27 (batch 2, user check): Discogs VinylStreetCo. kept (own site links it). The Discogs record store page still uses the old name: https://www.discogs.com/record-stores/store/vinyl-street-cafe/.

