import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';

const STORES = [
  { listing_id: 1, store_id: 1, store_name: 'Spin Cycle Records', area: 'Chelsea', distance_mi: 3.2,
    lat: 40.75, lng: -74, phone: '+1 212 555 0101', pressing_id: 1, pressing_note: '180g reissue', price: 26, condition: 'New', quantity: 2,
    freshness: 'current', last_updated_at: null },
  { listing_id: 2, store_id: 2, store_name: 'Second Pressing', area: 'Williamsburg', distance_mi: 8.7,
    lat: 40.8, lng: -74, phone: null, pressing_id: 2, pressing_note: 'Original press', price: 18, condition: 'VG+', quantity: 1,
    freshness: 'verified', last_updated_at: null },
  { listing_id: 3, store_id: 3, store_name: 'Dead Wax Exchange', area: 'White Plains', distance_mi: 44,
    lat: 41.3, lng: -74, phone: null,
    pressing_id: 2, pressing_note: 'Original press', price: 22, condition: 'NM', quantity: 1,
    freshness: 'current', last_updated_at: null },
];

/** Fake API: returns only the stores within the requested radius. */
async function mockStockApi(page: Page) {
  await page.route('**/api/albums/*/stock?*', async (route) => {
    const url = new URL(route.request().url());
    const radius = Number(url.searchParams.get('radius'));
    const stores = STORES.filter((s) => s.distance_mi <= radius);
    await route.fulfill({
      json: { album_id: 1, center_lat: 40.74, center_lng: -74, zip: url.searchParams.get('zip'), radius_mi: radius, stores,
              nearest_outside_mi: stores.length ? null : 3.2 },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockStockApi(page);
  await page.route('**/api/albums/*/online', route => route.fulfill({ json: { album_id: 1, album_title: 'Rumours', artist_name: 'Fleetwood Mac', sellers: [{ name: 'Discogs marketplace', url: 'https://www.discogs.com/sell/list?q=Fleetwood+Mac+Rumours+vinyl' }] } }));
  await page.goto('/albums/1/stores');
});

test('shows nearby stores and updates when the radius changes', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '2 stores have it' })).toBeVisible();

  await page.getByRole('button', { name: '50 mi' }).click();
  await expect(page.getByRole('heading', { name: '3 stores have it' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dead Wax Exchange' })).toBeVisible();
});

test('empty radius offers a wider search', async ({ page }) => {  // AC-03
  await page.route('**/api/albums/*/stock?*', (route) =>
    route.fulfill({ json: { album_id: 1, zip: '10011', radius_mi: 10, stores: [], nearest_outside_mi: 38 } }),
  );
  await page.getByRole('button', { name: '10 mi' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing within 10 mi' })).toBeVisible();
  await expect(page.getByText('Nearest copy is 38 mi away.')).toBeVisible();
});

test('dark mode can be chosen and survives a reload', async ({ page }) => {  // AC-14
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('has no automatically detectable accessibility problems', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '2 stores have it' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

for (const theme of ['Light', 'Dark']) {
  test(`server error offers Try again and passes axe in ${theme.toLowerCase()} mode`, async ({ page }) => {
    await page.getByRole('button', { name: theme }).click();
    await page.route('**/api/albums/*/stock?*', (route) => route.fulfill({ status: 503, body: '' }));
    await page.getByRole('button', { name: '10 mi' }).click();
    await expect(page.getByRole('alert')).toHaveText("Can't reach Binhopper right now.");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await mockStockApi(page);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: '2 stores have it' })).toBeVisible();
  });
}

test('AC-01 map pins and list refresh together without geolocation', async ({ page }) => {
  await expect(page.locator('.shop-marker')).toHaveCount(2);
  await page.getByRole('button', { name: '50 mi' }).click();
  await expect(page.locator('.shop-marker')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Directions to Spin Cycle Records' })).toHaveAttribute('href', /destination=40.75,-74/);
  await expect(page.getByRole('link', { name: 'Call shop' })).toHaveAttribute('href', 'tel:+12125550101');
  await page.getByTitle('1. Spin Cycle Records', { exact: true }).click();
  await expect(page.locator('.leaflet-popup-content')).toContainText('Spin Cycle Records');
});

for (const theme of ['Light', 'Dark']) {
  test(`AC-03 AC-05 map, stale call and online fallback in ${theme}`, async ({ page }) => {
    await page.getByRole('button', { name: theme }).click();
    await page.route('**/api/albums/*/stock?*', route => route.fulfill({ json: {
      album_id: 1, zip: '10011', center_lat: 40.74, center_lng: -74, radius_mi: 10,
      stores: [{ ...STORES[0], freshness: 'out_of_date' }], nearest_outside_mi: null,
    } }));
    await page.getByRole('button', { name: '10 mi' }).click();
    await expect(page.getByRole('link', { name: 'Call to confirm' })).toHaveAttribute('href', 'tel:+12125550101');
    await page.screenshot({ path: test.info().outputPath(`nearby-stale-${theme}.png`), fullPage: true });
    await page.route('**/api/albums/*/stock?*', route => route.fulfill({ json: {
      album_id: 1, zip: '10011', center_lat: 40.74, center_lng: -74, radius_mi: 25,
      stores: [], nearest_outside_mi: 38,
    } }));
    await page.getByRole('button', { name: '25 mi' }).click();
    await expect(page.getByRole('link', { name: 'See online sellers instead' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Discogs marketplace' })).toHaveAttribute('href', /Rumours/);
    await expect(page.getByRole('link', { name: /alert/i })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`nearby-empty-${theme}.png`), fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
