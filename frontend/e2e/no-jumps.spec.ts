import { expect, test, type Page } from '../test/fixtures';
import { fakeApi } from '../test/fake-api';

// Owner's report on staging: Hold or buy, Report stock, a copy's page and Add to collection
// showed "Loading…" then jumped. Each page's data now arrives before you do (fetched on hover,
// focus or touch, in the background from Nearby, or handed over by the album page), so the page
// opens complete. Every check below runs with the API slowed down AFTER the early fetch, and
// looks the moment the page opens: no placeholder, no "Loading…", the real content already there.

async function slowFromNowOn(page: Page, pattern: RegExp) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fallback();
  });
}

async function opensComplete(page: Page, heading: RegExp | string) {
  expect(await page.locator('.page-placeholder, .list-placeholder').count()).toBe(0);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 500 });
  expect(await page.getByText('Loading…', { exact: true }).count()).toBe(0);
}

test.beforeEach(async ({ page }) => { await fakeApi(page); });

test('Hold or buy opens complete from Nearby', async ({ page }) => {
  const early = page.waitForResponse(/\/api\/listings\/\d+$/);
  await page.goto('/albums/1/stores');
  await early;  // Nearby fetched the Hold or buy pages in the background
  await slowFromNowOn(page, /\/api\/listings\/\d+$/);
  await page.getByRole('link', { name: /^Hold or buy:/ }).first().click();
  await opensComplete(page, 'Rumours');
});

test('Report stock opens complete once you point at it', async ({ page }) => {
  await page.goto('/albums/1/stores');
  const link = page.getByRole('link', { name: /^(Report stock|I checked it):/ }).first();
  const early = page.waitForResponse(/\/api\/stock\/\d+$/);
  await link.hover();
  await early;
  await slowFromNowOn(page, /\/api\/stock\/\d+$/);
  await link.click();
  await opensComplete(page, "I'm at the shop");
});

test("a copy's page opens complete from Collection", async ({ page }) => {
  await page.goto('/collection');
  const tile = page.locator('.collection-tile').first();
  const early = page.waitForResponse(/\/api\/me\/collection\/\d+$/);
  await tile.hover();
  await early;
  await slowFromNowOn(page, /\/api\/me\/collection\/\d+$/);
  await tile.click();
  await opensComplete(page, 'Rumours');
});

test('Add to collection opens complete from the album page', async ({ page }) => {
  await page.goto('/albums/1');
  await expect(page.getByRole('heading', { level: 1, name: 'Rumours' })).toBeVisible();
  await slowFromNowOn(page, /\/api\/albums\/\d+(\?|$)/);
  await page.getByRole('link', { name: 'Add to collection' }).click();
  await opensComplete(page, 'Add to collection');
  await expect(page.getByText('Rumours · Fleetwood Mac')).toBeVisible({ timeout: 500 });
  await expect(page.getByRole('button', { name: /Original press/ })).toBeVisible({ timeout: 500 });
});

test("Nearby's first load holds the map's place, so nothing moves when it arrives", async ({ page }) => {
  await slowFromNowOn(page, /\/api\/albums\/\d+\/stock\?/);
  await page.goto('/albums/1/stores');
  const placeholder = (await page.locator('.stock-map--placeholder').boundingBox())!;
  await expect(page.locator('.stock-map').first()).not.toHaveClass(/placeholder/, { timeout: 5_000 });
  const map = (await page.locator('.stock-map').first().boundingBox())!;
  expect([Math.round(map.x), Math.round(map.y), Math.round(map.width), Math.round(map.height)])
    .toEqual([Math.round(placeholder.x), Math.round(placeholder.y), Math.round(placeholder.width), Math.round(placeholder.height)]);
});

test('You opens complete from the header', async ({ page }) => {
  const early = page.waitForResponse(/\/api\/me\/settings$/);
  await page.goto('/search');
  await early;  // signed in: the settings are fetched in the background
  await slowFromNowOn(page, /\/api\/me\/settings$/);
  await page.getByRole('link', { name: 'You: account and settings' }).click();
  await opensComplete(page, 'You');
  await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible({ timeout: 500 });
});
