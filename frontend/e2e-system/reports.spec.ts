import { expect, test } from '../test/fixtures';
import { signUp } from '../test/system-account';

// Read-only: submitting a report changes the shared sample seed (freshness, price, or moving
// Side B into stock) that the other system specs check. Submitting is covered by
// test_reports_api.py (AC-07, AC-18) and e2e/reports.spec.ts.
test('report screens load the real listing and the call-to-check shop', async ({ page }, testInfo) => {
  await signUp(page, `reports-${testInfo.project.name}`);
  await page.goto('/albums/1/stores');
  await page.getByRole('link', { name: 'Report stock: Spin Cycle Records' }).click();
  await expect(page.getByRole('heading', { name: "I'm at the shop" })).toBeVisible();
  await expect(page.getByText(/^Listed: 180g reissue · New · \$26\.00 · 2 in stock/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();

  await page.goto('/albums/1/stores');
  await page.getByRole('link', { name: 'I saw it here: Side B Listening Room' }).click();
  await expect(page.getByRole('heading', { name: 'I saw it here' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Original press/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /180g reissue/ })).toBeVisible();
});
