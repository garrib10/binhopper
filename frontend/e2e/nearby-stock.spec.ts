import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const STORES = [
  { listing_id: 1, store_id: 1, store_name: 'Spin Cycle Records', area: 'Chelsea', distance_mi: 3.2,
    pressing_id: 1, pressing_note: '180g reissue', price: 26, condition: 'New', quantity: 2,
    freshness: 'current', last_updated_at: null },
  { listing_id: 2, store_id: 2, store_name: 'Second Pressing', area: 'Williamsburg', distance_mi: 8.7,
    pressing_id: 2, pressing_note: 'Original press', price: 18, condition: 'VG+', quantity: 1,
    freshness: 'verified', last_updated_at: null },
  { listing_id: 3, store_id: 3, store_name: 'Dead Wax Exchange', area: 'White Plains', distance_mi: 44,
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
      json: { album_id: 1, zip: url.searchParams.get('zip'), radius_mi: radius, stores,
              nearest_outside_mi: stores.length ? null : 3.2 },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockStockApi(page);
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
