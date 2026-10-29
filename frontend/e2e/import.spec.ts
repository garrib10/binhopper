import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../test/fixtures';

const account = { id: 1, username: 'crate_digger', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };

for (const theme of ['light', 'dark'] as const) {
  test(`AC-11 Discogs import: choose lists, watch progress, see what was skipped (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    let polls = 0;
    let started = false;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
    await page.route('**/api/me/wishlist/albums', (route) => route.fulfill({ json: { album_ids: [] } }));
    await page.route('**/api/me/import/discogs', (route) => {
      if (route.request().method() === 'POST') { started = true; return route.fulfill({ status: 202, json: {} }); }
      const job = !started ? null : polls++ < 1
        ? { id: 1, status: 'running', added: 2, wishlisted: 0, skipped: 3, looking_up: 0, not_found: 0, error: null }
        : { id: 1, status: 'done', added: 5, wishlisted: 2, skipped: 3, looking_up: 0, not_found: 0, error: null };
      return route.fulfill({ json: { configured: true, connected: true, username: 'crate_digger', job } });
    });
    await page.goto('/import');
    await expect(page.getByText('Connected to Discogs as')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText(/3 skipped/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Duplicates skipped')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('not connected yet: one clear way to connect', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
  await page.route('**/api/me/import/discogs', (route) => route.fulfill({ json: { configured: true, connected: false, username: null, job: null } }));
  await page.goto('/import');
  await expect(page.getByRole('link', { name: 'Connect Discogs' })).toHaveAttribute('href', '/api/discogs/connect');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
