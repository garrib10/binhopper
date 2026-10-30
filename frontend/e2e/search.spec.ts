import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../test/fixtures';

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

test('switching Albums / Artists / Genre & year doesn’t move the page', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: {} }));
  const spots: string[] = [];
  for (const path of ['/search', '/search?type=artists', '/genres']) {
    await page.goto(path);
    // Measure with the real fonts: the wider fallback font wraps the header and title differently.
    await page.evaluate(() => document.fonts.ready);
    const title = (await page.locator('h1').first().boundingBox())!;
    const tabs = (await page.getByRole('navigation', { name: 'Search by' }).boundingBox())!;
    spots.push(`title x=${Math.round(title.x)} y=${Math.round(title.y)}; tabs x=${Math.round(tabs.x)} y=${Math.round(tabs.y)} w=${Math.round(tabs.width)}`);
  }
  expect(new Set(spots).size, spots.join('\n')).toBe(1);
  await expect(page.getByRole('link', { name: 'Search', exact: true })).toHaveAttribute('aria-current', 'page');
});
