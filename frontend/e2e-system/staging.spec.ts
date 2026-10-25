import { expect, test } from '@playwright/test';
import type { NearbyStockResponse } from '../src/api';

// These checks use only GET requests. They tolerate sample data aging between deploys
// by comparing the UI with the live API rather than assuming frozen freshness tiers.
const api = process.env.API_URL?.replace(/\/$/, '');

test('staging API is the expected deployment', async ({ request }) => {
  const response = await request.get(`${api}/api/health`);
  expect(response.status()).toBe(200);
  const health = await response.json();
  expect(health.status).toBe('ok');
  if (process.env.EXPECTED_COMMIT) expect(health.commit).toBe(process.env.EXPECTED_COMMIT);
});

for (const radius of [10, 25] as const) {
  test(`live nearby stock at ${radius} mi matches the API`, async ({ page }) => { // AC-01
    const response = page.waitForResponse((res) =>
      res.url().startsWith(`${api}/api/albums/1/stock?`) &&
      new URL(res.url()).searchParams.get('radius') === String(radius),
    );
    await page.goto('/');
    if (radius === 10) await page.getByRole('button', { name: '10 mi', exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    const body: NearbyStockResponse = await result.json();
    expect(body.stores.length).toBeGreaterThan(0); // Staging has the fictional sample seed.
    expect(body.stores.every((store) => store.distance_mi <= radius)).toBe(true);
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(
      body.stores.map((store) => store.store_name),
    );
  });
}

test('invalid ZIP stays in the browser without an API request', async ({ page }) => { // AC-04
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  const calls: string[] = [];
  page.on('request', (req) => {
    if (req.url().startsWith(`${api}/api/`)) calls.push(req.url());
  });
  await page.getByLabel('ZIP code').fill('1001');
  await page.getByLabel('ZIP code').press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Enter a 5-digit ZIP code');
  expect(calls).toEqual([]);
});
