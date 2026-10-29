import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../test/fixtures';

const account = { id: 1, username: 'collector-1', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };
const record = { listing_id: 3, album: { id: 1, title: 'Rumours', year: 1977, artist: 'Fleetwood Mac', cover_url: null },
  pressing: { id: 12, note: '180g reissue', label: 'Warner Bros.', format: 'LP' },
  store: { id: 1, name: 'Spin Cycle Records', area: 'Chelsea', address: null, phone: '(212) 555-0101', website: null, lat: 40.75, lng: -74 },
  price: 26, condition: 'New', quantity: 2, freshness: 'current', discogs_url: null };

for (const theme of ['light', 'dark'] as const) {
  test(`AC-10 hand off, come back, "Got it?" moves it from wishlist to collection (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const state = { wishlisted: true, collected: false };
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
    await page.route('**/api/listings/3', (route) => route.fulfill({ json: record }));
    await page.route('**/api/me/wishlist/albums', (route) => route.fulfill({ json: { album_ids: state.wishlisted ? [1] : [] } }));
    await page.route('**/api/me/wishlist?*', (route) => route.fulfill({ json: { items: state.wishlisted ? [{ id: 7,
      album: { id: 1, title: 'Rumours', year: 1977, cover_url: null, artist: { id: 1, name: 'Fleetwood Mac' } }, pressing_id: null,
      pressing_note: null, max_price: null, min_condition: null, pressings: [], store_count: 1,
      nearest: { store_name: 'Spin Cycle Records', distance_mi: 0.4, price: 26 }, cheapest: null, nearest_outside_mi: null }] : [] } }));
    await page.route('**/api/me/collection/from-listing', (route) => {
      state.wishlisted = false; state.collected = true;
      return route.fulfill({ status: 201, json: { id: 9, removed_from_wishlist: true } });
    });
    await page.goto('/records/3');
    await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    // Calling the shop is the hand-off. Keep the browser from opening its phone-app dialog
    // (Firefox's blocks the page afterwards); the app's own click handler still runs.
    const call = page.getByRole('link', { name: 'Call store' });
    await call.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault(), { once: true }));
    await call.click();
    await expect(page.getByRole('heading', { name: 'Got Rumours?' })).toBeVisible();

    // Later, back on the wishlist, it asks again.
    await page.goto('/wishlist');
    await expect(page.getByRole('heading', { name: 'Got Rumours?' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: "It's on my shelf, add to collection" }).click();
    await expect(page.getByRole('heading', { name: 'Added to your collection' })).toBeVisible();
    await expect(page.getByText('Rumours moved off your wishlist.', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nothing on your wishlist yet' })).toBeVisible();
    expect(state.collected).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Got Rumours?' })).toHaveCount(0);
  });
}
