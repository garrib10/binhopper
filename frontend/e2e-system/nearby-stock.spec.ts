import { expect, test, type Page } from '../test/fixtures';

/**
 * Nearby stock end to end: real API and MySQL; third-party map/Discogs services mocked.
 *
 * Data comes from backend/scripts/seed_sample.py (Rumours, four NYC shops around ZIP
 * 10011) plus ZIP 06010 from tests/fixtures/gazetteer_zcta_sample.txt, which is about
 * 62 mi from the nearest shop. The fixture also re-loads 10011 with its Census center,
 * so distances from 10011 are: Spin Cycle 0.3, Second Pressing 3.2, Groove Merchant 12.4,
 * Dead Wax Exchange 23.7.
 */

async function searchZip(page: Page, zip: string) {
  const input = page.getByLabel('ZIP code');
  await input.fill(zip);
  await input.press('Enter');
}

function storeNames(page: Page) {
  return page.getByRole('heading', { level: 3 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/albums/1/stores');
});

test('radius 10 shows only the shops within 10 mi, closest first', async ({ page }) => {  // AC-01
  await page.getByRole('button', { name: '10 mi' }).click();
  await expect(page.getByRole('heading', { name: '2 stores have it' })).toBeVisible();
  await expect(storeNames(page)).toHaveText(['Second Pressing', 'Spin Cycle Records']);
});

test('radius 25 sorts by freshness tier, then distance', async ({ page }) => {  // AC-01
  await expect(page.getByRole('heading', { name: '4 stores have it' })).toBeVisible();
  // Verified first, then current (nearest first), then out of date.
  await expect(storeNames(page)).toHaveText([
    'Second Pressing',
    'Spin Cycle Records',
    'Dead Wax Exchange',
    'Groove Merchant',
  ]);
  await expect(page.getByText('23.7 mi · White Plains')).toBeVisible();
  await expect(page.getByText('May be out of date: call to confirm')).toBeVisible();
});

test('empty radius shows the nearest copy and widens to find it', async ({ page }) => {  // AC-03
  await searchZip(page, '06010');
  await expect(page.getByRole('heading', { name: 'Nothing within 25 mi' })).toBeVisible();
  await expect(page.getByText('Nearest copy is 61.8 mi away.')).toBeVisible();

  await page.getByRole('button', { name: 'Try 50 mi' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing within 50 mi' })).toBeVisible();

  await page.getByRole('button', { name: 'Try 100 mi' }).click();
  await expect(page.getByRole('heading', { name: '4 stores have it' })).toBeVisible();
});

test('an unknown ZIP gets a clear message from the API', async ({ page }) => {  // AC-04
  await expect(page.getByRole('heading', { name: '4 stores have it' })).toBeVisible();
  await searchZip(page, '99999');
  await expect(page.getByRole('alert')).toHaveText(
    "We don't have that ZIP yet. Check it or try a nearby one.",
  );
});

test('a 4-digit ZIP is rejected without calling the API', async ({ page }) => {  // AC-04
  await expect(page.getByRole('heading', { name: '4 stores have it' })).toBeVisible();
  const apiCalls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/')) apiCalls.push(req.url());
  });

  await searchZip(page, '1001');
  await expect(page.getByRole('alert')).toHaveText('Enter a 5-digit ZIP code');
  expect(apiCalls).toEqual([]);
});

for (const theme of ['Light', 'Dark']) {
  test(`AC-01 AC-03 AC-04 map follows ZIP and radius with real API in ${theme}`, async ({ page }) => {
    await page.getByRole('button', { name: theme }).click();
    await expect(page.locator('.shop-marker')).toHaveCount(4);
    await expect(page.getByRole('link', { name: 'Discogs marketplace' })).toHaveAttribute('href', /Rumours/);
    await page.screenshot({ path: test.info().outputPath(`nearby-${theme}.png`), fullPage: true });
    await searchZip(page, '06010');
    await expect(page.getByRole('heading', { name: 'Nothing within 25 mi' })).toBeVisible();
    await expect(page.locator('.shop-marker')).toHaveCount(0);
    await expect(page.getByText('25 mi radius · Centered on ZIP 06010, not your precise location.')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`empty-${theme}.png`), fullPage: true });
    await page.getByRole('button', { name: '100 mi' }).click();
    await expect(page.locator('.shop-marker')).toHaveCount(4);
    await searchZip(page, '1001');
    await expect(page.getByRole('alert')).toHaveText('Enter a 5-digit ZIP code');
    await expect(page.locator('.shop-marker')).toHaveCount(4);
  });
}
