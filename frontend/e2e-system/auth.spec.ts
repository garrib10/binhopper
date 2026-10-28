import { expect, test } from '../test/fixtures';
import { latestEmail, linkPath, PASSWORD, signUp } from '../test/system-account';

test('AC-19 AC-21 real sign-up, emailed link, sign out, sign in, reset', async ({ page }, testInfo) => {
  const email = await signUp(page, testInfo.project.name);
  await page.goto('/you');
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await page.goto('/sign-in?return_to=%2Fwishlist');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Wishlist', exact: true })).toBeVisible();

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.goto(linkPath(await latestEmail(email, 'Reset your Binhopper password')));
  await page.getByLabel('New password', { exact: true }).fill('a-brand-new-pass');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
});
