import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';

const account = { id: 1, username: 'crate_digger', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };

async function fakeApi(page: Page) {
  let settings = { username: 'crate_digger', email: 'collector@example.com', sign_in_methods: ['password'], home_zip: '10011',
    default_radius_mi: 25, theme: 'system', use_current_location: false, privacy_profile: 'private', privacy_collection: 'private',
    privacy_wishlist: 'private', favorite_genres: ['Rock'], genres: ['Rock', 'Jazz', 'Soul & Funk', 'Hip-Hop', 'Electronic', 'Folk'] };
  const state = { deleted: false };
  await page.route('**/api/auth/me', (route) => route.fulfill(state.deleted ? { status: 401, json: {} } : { json: account }));
  await page.route('**/api/me/wishlist/albums', (route) => route.fulfill({ json: { album_ids: [] } }));
  await page.route('**/api/me', (route) => { state.deleted = true; return route.fulfill({ status: 204 }); });
  await page.route('**/api/me/settings', (route) => {
    if (route.request().method() === 'PATCH') settings = { ...settings, ...route.request().postDataJSON() };
    return route.fulfill({ json: settings });
  });
  return state;
}

for (const theme of ['light', 'dark'] as const) {
  test(`You tabs pass axe and keep 44 px targets (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await fakeApi(page);
    await page.goto('/search');
    await page.getByRole('link', { name: 'You: account and settings' }).click();
    for (const tab of ['Profile', 'Settings', 'Privacy', 'Account']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tabpanel', { name: tab })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const control of await page.getByRole('tabpanel').getByRole('button').all()) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
      }
    }
  });
}

test('AC-14 "Match system" follows the device; Dark in You › Settings sticks', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await fakeApi(page);
  await page.goto('/you/settings');
  const appearance = page.getByRole('tabpanel').getByRole('group', { name: 'Appearance' });
  await expect(appearance.getByRole('button', { name: 'Match system' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  await page.emulateMedia({ colorScheme: 'light' });
  await appearance.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('AC-15 deleting the account asks first, then signs you out', async ({ page }) => {
  const state = await fakeApi(page);
  await page.goto('/you/account');
  await page.getByRole('button', { name: 'Delete account…' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Delete your account?' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Delete forever' }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(state.deleted).toBe(true);
});
