import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';

// #45: every screen has a loading, empty and error state; network errors offer Try again and
// no raw error text reaches the user. Each screen's API is broken on purpose here.
const account = { id: 1, username: 'collector-1', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };

async function signedIn(page: Page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
  await page.route('**/api/me/wishlist/albums', (route) => route.fulfill({ json: { album_ids: [] } }));
}

const BROKEN: { screen: string; path: string; api: string }[] = [
  { screen: 'Search', path: '/search?q=rumours', api: '**/api/search?*' },
  { screen: 'Album', path: '/albums/1', api: '**/api/albums/1?*' },
  { screen: 'Artist', path: '/artists/1', api: '**/api/artists/1?*' },
  { screen: 'Nearby stock', path: '/albums/1/stores', api: '**/api/albums/1/stock?*' },
  { screen: 'Wishlist', path: '/wishlist', api: '**/api/me/wishlist?*' },
  { screen: 'Collection', path: '/collection', api: '**/api/me/collection?*' },
  { screen: 'Your copy', path: '/collection/5', api: '**/api/me/collection/5' },
  { screen: 'Hold or buy', path: '/records/3', api: '**/api/listings/3' },
  { screen: 'Report stock', path: '/stock/3/report', api: '**/api/stock/3' },
  { screen: 'You', path: '/you', api: '**/api/me/settings' },
  { screen: 'Import', path: '/import', api: '**/api/me/import/discogs' },
];

for (const theme of ['light', 'dark'] as const) {
  test(`every screen recovers from a server error (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);  // 11 screens, each with an axe scan
    await page.emulateMedia({ colorScheme: theme });
    await signedIn(page);
    for (const { screen, path, api } of BROKEN) {
      await test.step(screen, async () => {
        let fail = true;
        await page.route(api, (route) => fail
          ? route.fulfill({ status: 502, body: '<html>Bad gateway: upstream timed out</html>' })
          : route.fulfill({ status: 200, json: {} }));
        await page.goto(path);
        await expect(page.getByRole('alert').filter({ hasText: "Can't reach Binhopper right now." })).toBeVisible();
        await expect(page.getByText('Bad gateway')).toHaveCount(0);  // no raw error text
        const retry = page.getByRole('button', { name: 'Try again' });
        await expect(retry).toBeVisible();
        expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        fail = false;
        await page.unroute(api);
      });
    }
  });

  test(`empty wishlist and collection say what to do next (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await signedIn(page);
    await page.route('**/api/me/wishlist?*', (route) => route.fulfill({ json: { items: [] } }));
    await page.route('**/api/me/collection?*', (route) => route.fulfill({ json: { items: [], stats: { records: 0, artists: 0, duplicates: 0, wishlist: 0 } } }));
    await page.goto('/wishlist');
    await expect(page.getByRole('heading', { name: 'Nothing on your wishlist yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add a record to your wishlist' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto('/collection');
    await expect(page.getByRole('heading', { name: 'No records yet' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('a record that no longer exists says so with a way back', async ({ page }) => {
  await page.route('**/api/albums/77?*', (route) => route.fulfill({ status: 404, json: { detail: 'Album not found' } }));
  await page.goto('/albums/77');
  await expect(page.getByRole('alert')).toHaveText("That album isn't in Binhopper.");
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to search' })).toBeVisible();
});

test('StaleStock: stale, verified and reported-missing cards explain themselves', async ({ page }) => {
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString().replace('Z', '');
  const card = { store_id: 1, area: 'Chelsea', distance_mi: 3.2, lat: 40.75, lng: -74, phone: '+1 212 555 0101',
    pressing_id: 1, pressing_note: '180g reissue', condition: 'New', quantity: 1, source: 'manual' };
  await page.route('**/api/albums/1/online', (route) => route.fulfill({ json: { album_id: 1, album_title: 'Rumours', artist_name: 'Fleetwood Mac', sellers: [] } }));
  await page.route('**/api/albums/1/stock?*', (route) => route.fulfill({ json: { album_id: 1, zip: '10011', radius_mi: 25,
    center_lat: 40.74, center_lng: -74, nearest_outside_mi: null, stores: [
      { ...card, listing_id: 1, store_name: 'Spin Cycle Records', price: 26, freshness: 'verified', last_updated_at: at(2) },
      { ...card, listing_id: 2, store_name: 'Groove Merchant', price: 28, freshness: 'out_of_date', last_updated_at: at(9 * 24) },
      { ...card, listing_id: 3, store_name: 'Second Pressing', price: 18, freshness: 'reported_missing', missing_reports: 2, last_updated_at: at(30) },
    ] } }));
  await page.goto('/albums/1/stores');
  await expect(page.getByText('Verified on the shelf 2 hr ago')).toBeVisible();
  await expect(page.getByText(/stock last updated 9 days ago\. It may have sold\. Call before you make the trip\./)).toBeVisible();
  await expect(page.getByRole('link', { name: 'I checked it: Groove Merchant' })).toBeVisible();
  await expect(page.getByText("Reported missing today: 2 people didn't find it")).toBeVisible();
  await expect(page.getByText('Stores are ranked by how fresh their stock data is, then distance.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
