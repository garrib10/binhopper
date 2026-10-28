import { expect, test } from '../test/fixtures';
import { signUp } from '../test/system-account';

test('AC-08 the heart adds then removes, and a reload shows the final state', async ({ page }, testInfo) => {
  await signUp(page, `wish-${testInfo.project.name}`);
  await page.goto('/albums/1');
  const heart = page.getByRole('button', { name: /wishlist/i });
  await expect(heart).toHaveText('Add to wishlist');
  await heart.click();
  await expect(heart).toHaveText('On wishlist');
  await page.reload();
  await expect(page.getByRole('button', { name: 'On wishlist' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible();
  await expect(page.getByText('4 stores in range')).toBeVisible(); // the sample seed, 25 mi of 10011
  await expect(page.getByText(/^Nearest: Spin Cycle Records · [\d.]+ mi · \$26$/)).toBeVisible();

  await page.goto('/albums/1');
  await page.getByRole('button', { name: 'On wishlist' }).click();
  await expect(page.getByRole('button', { name: 'Add to wishlist' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add to wishlist' })).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Nothing on your wishlist yet' })).toBeVisible();
});
