import { expect, test, type Page } from '../test/fixtures';
import { fakeApi } from '../test/fake-api';

// Key screens with fixed, fictional data (test/fake-api.ts). AC-14: each theme renders as
// designed, and a token or CSS change that breaks one theme fails here.
// Web fonts are blocked so text renders with the same fallback font every run; layout,
// spacing and every color still come from the app's CSS and tokens.
const SCREENS: { name: string; path: string; signedIn?: boolean }[] = [
  { name: 'search', path: '/search?q=rumours' },
  { name: 'album', path: '/albums/1' },
  { name: 'nearby-stock', path: '/albums/1/stores' },
  { name: 'wishlist', path: '/wishlist' },
  { name: 'collection', path: '/collection' },
  { name: 'you-settings', path: '/you/settings' },
  { name: 'onboarding', path: '/onboarding' },
  { name: 'sign-in', path: '/sign-in', signedIn: false },
  { name: 'privacy', path: '/privacy', signedIn: false },
];

async function steady(page: Page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
}

for (const theme of ['light', 'dark'] as const) {
  for (const { name, path, signedIn = true } of SCREENS) {
    test(`AC-14 ${name} looks right in ${theme}`, async ({ page }) => {
      await steady(page);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await fakeApi(page, { signedIn });
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: /^Loading|^Searching|^Finding/ })).toHaveCount(0);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
        fullPage: true,
        mask: [page.locator('.stock-map')],  // map tiles and pin layout are covered by e2e tests
      });
    });
  }
}
