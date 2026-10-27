import { expect, test } from '../test/fixtures';

for (const theme of ['light', 'dark'] as const) {
  test(`album links, track sides and pressings use real API in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/albums/1');
    await expect(page.getByRole('heading', { name: 'Rumours', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Side A' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Side B' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fleetwood Mac', exact: true })).toHaveAttribute('href', /\/artists\/\d+/);
    await page.screenshot({ path: test.info().outputPath(`album-tracks-${theme}.png`), fullPage: true });
    await page.getByRole('button', { name: /Pressings/ }).click();
    await expect(page.getByText('Original press', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Data provided by Discogs.' })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`album-${theme}.png`), fullPage: true });
    await page.getByRole('link', { name: /Find in stores/ }).click();
    await expect(page).toHaveURL(/\/albums\/1\/stores$/);
  });
}
