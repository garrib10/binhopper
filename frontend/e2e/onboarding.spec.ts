import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../test/fixtures';

const account = { id: 1, username: 'collector-1', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };

for (const theme of ['light', 'dark'] as const) {
  test(`onboarding: location, radius, genres, then import or skip (${theme})`, async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: theme });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 40.7317, longitude: -73.9891 });
    let settings = { username: 'collector-1', email: 'collector@example.com', sign_in_methods: ['password'], home_zip: null,
      default_radius_mi: 25, theme: 'system', use_current_location: false, privacy_profile: 'private', privacy_collection: 'private',
      privacy_wishlist: 'private', favorite_genres: [] as string[], genres: ['Rock', 'Jazz', 'Soul & Funk', 'Hip-Hop', 'Electronic', 'Folk',
        'Country', 'Reggae', 'Classical', 'Metal', 'Latin', 'Blues'] };
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
    await page.route('**/api/me/wishlist/albums', (route) => route.fulfill({ json: { album_ids: [] } }));
    await page.route('**/api/zips/nearest?*', (route) => route.fulfill({ json: { zip: '10003' } }));
    await page.route('**/api/me/settings', (route) => {
      if (route.request().method() === 'PATCH') settings = { ...settings, ...route.request().postDataJSON() };
      return route.fulfill({ json: settings });
    });
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByLabel('Enter a ZIP code')).toHaveValue('10003');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /10 mi/ }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Continue' }).click();
    for (const genre of ['Rock', 'Soul & Funk']) await page.getByRole('button', { name: genre }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (const control of await page.getByRole('button').all()) {
      const box = await control.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(43.5);
    }
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Got records already?' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/\/search$/);
    expect([settings.home_zip, settings.default_radius_mi, settings.favorite_genres]).toEqual(['10003', 10, ['Rock', 'Soul & Funk']]);
  });
}
