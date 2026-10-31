import { expect, test } from '../test/fixtures';
import { fakeApi } from '../test/fake-api';

test('Wishlist and Collection show the last list at once on a return visit', async ({ page }) => {
  await fakeApi(page);
  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  // Scoped to the grid: the Wishlist page, still showing for a moment, also links to Rumours.
  const collected = page.locator('.collection-grid').getByRole('link', { name: /Rumours/ });
  await nav.getByRole('link', { name: 'Collection' }).click();
  await expect(collected).toBeVisible();

  // From now on the API answers slowly; the remembered lists must not wait for it.
  await page.route(/\/api\/me\/(wishlist|collection)\?/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.fallback();
  });
  await nav.getByRole('link', { name: 'Wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible({ timeout: 1_000 });
  await nav.getByRole('link', { name: 'Collection' }).click();
  await expect(collected).toBeVisible({ timeout: 1_000 });
});

test('a first visit shows placeholder cards while the list loads', async ({ page }) => {
  await fakeApi(page);
  await page.route(/\/api\/me\/wishlist\?/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.fallback();
  });
  await page.goto('/wishlist');
  await expect(page.locator('.list-placeholder__item')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible();
  await expect(page.locator('.list-placeholder')).toHaveCount(0);
});

test('a record that leaves the wishlist does not flash on the next visit', async ({ page }) => {
  // Owner's report: after a copy took Rumours off the wishlist, Wishlist showed it for a split second.
  await fakeApi(page);
  let wished = true;
  await page.route(/\/api\/me\/wishlist\?/, async (route) => {
    if (wished) return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, 1_500));  // slow, so a stale list would be seen
    await route.fulfill({ json: { items: [] } });
  });
  await page.route('**/api/me/collection', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 201, json: { id: 9, album: { id: 1, title: 'Rumours' }, removed_from_wishlist: true, album_on_wishlist: false } })
    : route.fallback());
  const nav = page.getByRole('navigation', { name: 'Main' });
  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible();  // remembered now

  // Clicking through, as the owner did: a full page load would forget the remembered list anyway.
  await page.getByRole('heading', { name: 'Rumours' }).getByRole('link').click();
  await page.getByRole('link', { name: 'Add to collection' }).click();
  await page.getByRole('button', { name: /180g reissue/ }).click();
  wished = false;
  await page.getByRole('button', { name: 'Add to collection' }).click();
  await expect(page).toHaveURL(/\/collection\/9/);

  await nav.getByRole('link', { name: 'Wishlist' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wishlist' })).toBeVisible();
  // Checked at once, not retried: a stale remembered list would show Rumours right now.
  expect(await page.getByRole('heading', { name: 'Rumours' }).count()).toBe(0);
  await page.waitForTimeout(500);
  expect(await page.getByRole('heading', { name: 'Rumours' }).count()).toBe(0);
  await expect(page.getByRole('heading', { name: 'Nothing on your wishlist yet' })).toBeVisible();
});
