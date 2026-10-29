import { expect, test } from '../test/fixtures';

test('AC-14 shell navigation preserves system theme, history and direct routes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/genres');
  await expect(page.getByRole('heading', { name: 'Browse', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(30, 11, 15)');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/genres$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Fgenres$/);
  // Signed-in screens send a signed-out visitor to sign in first.
  await page.goto('/collection');
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Fcollection$/);
  await page.goto('/not-a-route');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('nearby route keeps ZIP and radius after reload', async ({ page }) => {
  await page.goto('/albums/1/stores');
  await page.getByRole('button', { name: '50 mi', exact: true }).click();
  await page.getByLabel('ZIP code').fill('06010');
  await page.getByLabel('ZIP code').press('Enter');
  await page.reload();
  await expect(page.getByLabel('ZIP code')).toHaveValue('06010');
  await expect(page.getByRole('button', { name: '50 mi', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
