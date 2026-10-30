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

test('Search rules 1 and 5: genres and styles from the search box and the picker', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/genres', (route) => route.fulfill({ json: { genres: [
    { name: 'Rock', albums: 9, styles: ['Shoegaze', 'Pop Rock'] }, { name: 'Brass & Military', albums: 1, styles: [] }] } }));
  await page.route('**/api/search?*', (route) => route.fulfill({ json: { albums: [album], artists: [], genres: [{ name: 'Shoegaze', genre: 'Rock' }] } }));
  await page.route('**/api/browse?*', (route) => route.fulfill({ json: { albums: [album], artists: [] } }));
  await page.goto('/search');
  await page.getByLabel('Search records', { exact: true }).fill('shoegaze');
  await page.getByRole('link', { name: 'Browse Shoegaze →' }).click();
  await expect(page.getByRole('heading', { name: 'Shoegaze', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Change genre or year' }).click();
  await expect(page.getByRole('button', { name: 'Shoegaze' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Brass & Military' })).toBeVisible();
  for (const target of await page.getByRole('main').getByRole('button').all()) {
    expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
