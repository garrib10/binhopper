import { expect, test, type Page } from '@playwright/test';

/**
 * Nearby stock end to end: real API, real MySQL, nothing mocked.
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


test('AC-05 fictional manual stock retains its stale warning without a marketplace attribution', async ({ page }) => {
  await expect(page.getByText('May be out of date: call to confirm')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Data provided by Discogs.' })).toHaveCount(0);
});
