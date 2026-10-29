import { expect, test } from '../test/fixtures';
import { signUp } from '../test/system-account';

test('AC-10 a hand-off then "Got it?" moves the album from wishlist to collection', async ({ page }, testInfo) => {
  await signUp(page, `handoff-${testInfo.project.name}`);
  await page.goto('/albums/1');
  await page.getByRole('button', { name: 'Add to wishlist' }).click();
  await expect(page.getByRole('button', { name: 'On wishlist' })).toBeVisible();

  await page.goto('/albums/1/stores');
  await page.getByRole('link', { name: 'Hold or buy: Spin Cycle Records' }).click();
  await expect(page.getByRole('heading', { name: 'Spin Cycle Records' })).toBeVisible();
  await page.getByRole('link', { name: 'Directions' }).click({ modifiers: ['Meta'] });  // opens maps elsewhere; we stay
  await page.goto('/wishlist');
  await page.getByRole('button', { name: "It's on my shelf, add to collection" }).click();
  await expect(page.getByRole('heading', { name: 'Added to your collection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing on your wishlist yet' })).toBeVisible();

  await page.goto('/collection?view=list');
  await expect(page.getByRole('row', { name: /Rumours Fleetwood Mac 180g reissue/ })).toBeVisible();
});
