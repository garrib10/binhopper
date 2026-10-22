# Design mockups

Every screen from the Binhopper mockups canvas, as the source files the canvas
renders. Use them as the visual target when building React screens.

## How to read a mockup file

Each `*.dc.html` file is one screen. They are HTML templates, not plain pages:

- **Layout and styles** are inline `style="…"` attributes: exact sizes, spacing, colors and fonts.
- **`{{name}}`** is a value filled in by the script at the bottom of the file.
- **`<sc-for list="{{items}}" as="item">`** repeats its contents once per item (a list).
- **`<sc-if value="{{flag}}">`** shows its contents only when the flag is true.
- **The `<script>` at the bottom** holds the screen's sample data (`renderVals()`) and its
  interactions (`setState`). The sample data is fictional; real data comes from the API.
- **`<a href="Other.dc.html">`** shows where a tap navigates.

They won't render by opening them in a browser (they need the canvas runtime). Read them for
layout, copy and behavior. Colors in them are hard-coded; in the app, use the matching
variables in `frontend/src/styles/tokens.css` instead.

The brand name in the mockups is the old placeholder "Spindle"; the app is **Binhopper**.

## Screen index

| File | Screen | SPEC.md section | Release |
| --- | --- | --- | --- |
| Onboarding.dc.html | Onboarding (4 steps) | Onboarding | v1 |
| Main.dc.html | Search (albums, filters) | Search | v1 |
| Genre.dc.html | Browse by genre + decade + year | Search | v1 |
| Years.dc.html | Genre + year results | Search | v1 |
| Artist.dc.html | Artist page | Artist page | v1 |
| Album.dc.html | Album page: tracklist, pressings, listen links | Album page | v1 |
| Wishlist.dc.html | Wishlist | Wishlist | v1 |
| Stores.dc.html | Nearby stock: ZIP + radius, map, list, online sellers | Nearby stock | v1 |
| Record.dc.html | Locate, hold, buy, add to collection | Locate, hold, buy | v1 |
| Collection.dc.html | Collection grid | Collection | v1 |
| Owned.dc.html | Your copy: pressing, condition, notes | Collection | v1 |
| Import.dc.html | Import from Discogs | Discogs import | v1 |
| Report.dc.html | Confirm stock + rate a shop | Nearby stock (reports) | v1 |
| You.dc.html | Account settings, 4 tabs | Account settings | v1 |
| NotifySettings.dc.html | Notification settings | Account settings | v1.1 |
| EmptyRadius.dc.html | Empty: no stores in radius | Nearby stock rule 7 | v1 |
| LocationDenied.dc.html | Error: location off, use ZIP | Onboarding | v1 |
| StaleStock.dc.html | Warning: stale stock data | Nearby stock rule 5 | v1 |
| ScanNoMatch.dc.html | Error: scan found no match | | v1.1 |
| Scan.dc.html | Scan barcode or cover | | v1.1 |
| Alert.dc.html | Price + distance alert | | v1.1 |
| Inbox.dc.html | Notifications inbox | | v1.1 |
| Holds.dc.html | Holds & orders | | v1.1 |
| HoldExpired.dc.html | Error: hold expired | | v1.1 |
| Store.dc.html | Store profile + new arrivals | | v1.1 |
| Route.dc.html | Crate-digging route | | v1.2 |
| RSD.dc.html | Record Store Day | | v1.2 |
| Sell.dc.html | Sell or trade | | Later |
| Profile.dc.html | Shareable profile + gift list | | Later |
| DarkMain.dc.html | Search, dark mode | | v1 |
| DarkStores.dc.html | Nearby stock, dark mode | | v1 |
| DarkAlbum.dc.html | Album, dark mode | | v1 |
| Desktop.dc.html | Desktop: nearby stock | Nearby stock | v1 |
| DesktopSearch.dc.html | Desktop: search + filters | Search | v1 |
| DesktopAlbum.dc.html | Desktop: album | Album page | v1 |
| DesktopCollection.dc.html | Desktop: collection | Collection | v1 |
| DesktopYou.dc.html | Desktop: account settings, 5 tabs | Account settings | v1 |
