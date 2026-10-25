import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`artist discography uses real catalog and album links in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/artists/1');
    await expect(page.getByRole('heading', { name: 'Fleetwood Mac', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to follow' })).toBeDisabled();
    const album = page.getByRole('link', { name: /Rumours.*nearby/ });
    await expect(album).toBeVisible();
    await expect(page.getByRole('link', { name: 'Data provided by Discogs.' })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`artist-${theme}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Compilations', exact: true }).click();
    await expect(page.getByText('No compilations releases listed yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Studio', exact: true }).click();
    await album.click();
    await expect(page).toHaveURL(/\/albums\/1$/);
    await expect(page.getByRole('heading', { name: 'Rumours', exact: true })).toBeVisible();
  });
}
