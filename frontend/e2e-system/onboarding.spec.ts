import { expect, test } from '../test/fixtures';
import { signUp } from '../test/system-account';

test('a new account goes through onboarding and its choices land in You › Settings', async ({ page }, testInfo) => {
  await signUp(page, `onboard-${testInfo.project.name}`);
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Where do you dig?' })).toBeVisible();
  await page.getByLabel('Enter a ZIP code').fill('06010');  // in the system test's ZIP sample
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /50 mi/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Jazz' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByText('50 mi of 06010')).toBeVisible();  // search uses the new location
  await page.goto('/you/settings');
  await expect(page.getByRole('textbox', { name: 'Home ZIP' })).toHaveValue('06010');
  await expect(page.getByRole('button', { name: '50 mi' })).toHaveAttribute('aria-pressed', 'true');
});
