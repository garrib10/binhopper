import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`AC-12 search and genre/year browsing use the real API in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const calls: string[] = [];
    page.on('request', (req) => { if (req.url().includes('/api/search?')) calls.push(req.url()); });
    await page.goto('/search');
    await page.getByLabel('Search records', { exact: true }).fill('R');
    await page.waitForTimeout(400);
    expect(calls).toEqual([]);
    await page.getByLabel('Search records', { exact: true }).fill('Rumours');
    await expect(page.getByRole('link', { name: /Rumours.*Fleetwood Mac/ })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`search-${theme}.png`), fullPage: true });
    await page.getByRole('link', { name: /Rumours.*Fleetwood Mac/ }).click();
    await expect(page).toHaveURL(/\/albums\/1$/);
    await page.goto('/search?q=Fleetwood&type=artists');
    await expect(page.getByRole('link', { name: /Fleetwood Mac.*View artist/ })).toHaveAttribute('href', '/artists/1');
    await page.goto('/genres');
    await page.getByRole('button', { name: 'Rock', exact: true }).click();
    await page.getByRole('button', { name: '1970s', exact: true }).click();
    await page.getByRole('button', { name: '1977', exact: true }).click();
    await page.screenshot({ path: test.info().outputPath(`genre-picker-${theme}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Show Rock from 1977', exact: true }).click();
    await expect(page.getByRole('link', { name: /Rumours.*Fleetwood Mac/ })).toBeVisible();
    await page.getByRole('button', { name: 'In stock near me', exact: true }).click();
    await expect(page.getByRole('link', { name: /Rumours.*Fleetwood Mac/ })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`genre-year-${theme}.png`), fullPage: true });
  });
}
