import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const album = { id: 1, title: 'Rumours', artist: { id: 1, name: 'Fleetwood Mac' }, year: 1977,
  format: 'LP', cover_url: null, label: 'Warner Bros.', store_count: 3, lowest_price: 26,
  nearest_outside_mi: null, discogs_url: 'https://www.discogs.com/master/1' };
for (const theme of ['light', 'dark'] as const) {
  test(`AC-12 search debounce, empty recovery and accessibility in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const calls: string[] = [];
    await page.route('**/api/search?*', (route) => {
      calls.push(route.request().url());
      return route.fulfill({ json: { albums: new URL(route.request().url()).searchParams.get('q') === 'zzzz' ? [] : [album], artists: [] } });
    });
    await page.goto('/search');
    await page.getByLabel('Search records', { exact: true }).fill('R');
    await page.waitForTimeout(400);
    expect(calls).toEqual([]);
    await page.getByLabel('Search records', { exact: true }).fill('Ru');
    await expect(page.getByRole('link', { name: /Rumours.*Fleetwood/ })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByLabel('Search records', { exact: true }).fill('zzzz');
    await expect(page.getByRole('heading', { name: 'No records found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse by genre' })).toHaveAttribute('href', '/genres');
  });
}
