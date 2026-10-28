import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';

const account = { id: 1, username: 'collector-1', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };
const spin = { listing_id: 3, store_id: 1, store_name: 'Spin Cycle Records', area: 'Chelsea', distance_mi: 0.4, lat: 40.75, lng: -74,
  phone: null, pressing_id: 12, pressing_note: '180g reissue', price: 26, condition: 'New', quantity: 2, freshness: 'current',
  last_updated_at: null, source: 'manual' };
const sideB = { store_id: 9, name: 'Side B Listening Room', area: 'Hoboken, NJ', distance_mi: 1.5, phone: '(201) 555-0142', lat: 40.744, lng: -74.03 };

/** A signed-in fake API: one listing, one call-to-check shop, and the report rules. */
async function fakeApi(page: Page) {
  const state = { verified: false, reportedToday: false, sighted: false };
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
  await page.route('**/api/me/wishlist/albums', (route) => route.fulfill({ json: { album_ids: [] } }));
  await page.route('**/api/albums/1/online', (route) => route.fulfill({ json: { album_id: 1, album_title: 'Rumours', artist_name: 'Fleetwood Mac', sellers: [] } }));
  await page.route('**/api/albums/1/stock?*', (route) => route.fulfill({ json: {
    album_id: 1, zip: '10011', radius_mi: 25, center_lat: 40.74, center_lng: -74, nearest_outside_mi: null,
    stores: [{ ...spin, freshness: state.verified ? 'verified' : 'current' },
      ...(state.sighted ? [{ ...spin, listing_id: 4, store_id: 9, store_name: sideB.name, area: sideB.area, distance_mi: 1.5,
        pressing_note: 'Original press', price: 22, condition: 'Used', quantity: 1, freshness: 'verified', source: 'report' }] : [])],
    other_shops: state.sighted ? [] : [sideB] } }));
  await page.route('**/api/stock/3', (route) => route.fulfill({ json: { listing_id: 3, store: { id: 1, name: spin.store_name },
    album: { id: 1, title: 'Rumours' }, pressing_note: '180g reissue', price: 26, condition: 'New', quantity: 2, source: 'manual',
    freshness: 'current', last_updated_at: null, reported_today: state.reportedToday } }));
  await page.route('**/api/stock/3/reports', (route) => {
    if (state.reportedToday) return route.fulfill({ status: 429, json: { detail: 'You already reported this today' } });
    state.reportedToday = true; state.verified = route.request().postDataJSON().result === 'present';
    return route.fulfill({ status: 201, json: { listing_id: 3 } });
  });
  await page.route('**/api/stores/9/sighting?*', (route) => route.fulfill({ json: { store: { id: 9, name: sideB.name, area: sideB.area },
    album: { id: 1, title: 'Rumours', artist: 'Fleetwood Mac' },
    pressings: [{ id: 11, note: 'Original press', detail: 'LP' }, { id: 12, note: '180g reissue', detail: 'LP' }] } }));
  await page.route('**/api/stores/9/sightings', (route) => { state.sighted = true; return route.fulfill({ status: 201, json: { listing_id: 4 } }); });
}

for (const theme of ['light', 'dark'] as const) {
  test(`AC-07 report a listing once a day (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await fakeApi(page);
    await page.goto('/albums/1/stores');
    await page.getByRole('link', { name: 'Report stock: Spin Cycle Records' }).click();
    await expect(page.getByRole('heading', { name: "I'm at the shop" })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, it’s there' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByRole('status')).toContainText('verified for the next 24 hours');
    await page.getByRole('link', { name: 'Back to nearby stock' }).click();
    await expect(page.getByText('Verified on the shelf')).toBeVisible();

    await page.getByRole('link', { name: 'Report stock: Spin Cycle Records' }).click();
    await expect(page.getByText('You already reported this today. Thanks!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Not on the shelf' })).toBeDisabled();
  });

  test(`AC-18 "I saw it here" moves a call-to-check shop into stock (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await fakeApi(page);
    await page.goto('/albums/1/stores');
    await page.getByRole('link', { name: 'I saw it here: Side B Listening Room' }).click();
    await page.getByRole('button', { name: /Original press/ }).click();
    await page.getByRole('button', { name: 'Used' }).click();
    await page.getByLabel('Price on the sticker ($)').fill('22');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Add to nearby stock' }).click();
    await expect(page.getByRole('status')).toContainText('Side B Listening Room now shows Rumours');
    await page.getByRole('link', { name: 'Back to nearby stock' }).click();
    await expect(page.getByRole('heading', { name: '2 stores have it' })).toBeVisible();
    await expect(page.getByRole('list', { name: '2 stores have it' }).getByRole('heading', { name: 'Side B Listening Room' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Other record shops nearby' })).toHaveCount(0);
  });
}
