import { expect, test } from '../test/fixtures';
import { fakeApi } from '../test/fake-api';

test('Wishlist and Collection show the last list at once on a return visit', async ({ page }) => {
  await fakeApi(page);
  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Collection' }).click();
  await expect(page.getByRole('link', { name: /Rumours/ }).first()).toBeVisible();

  // From now on the API answers slowly; the remembered lists must not wait for it.
  await page.route(/\/api\/me\/(wishlist|collection)\?/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.fallback();
  });
  await nav.getByRole('link', { name: 'Wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible({ timeout: 1_000 });
  await nav.getByRole('link', { name: 'Collection' }).click();
  await expect(page.getByRole('link', { name: /Rumours/ }).first()).toBeVisible({ timeout: 1_000 });
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
