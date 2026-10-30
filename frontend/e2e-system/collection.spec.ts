import { expect, test } from '../test/fixtures';
import { signUp } from '../test/system-account';

test('AC-09 adding an owned pressing warns, and "Add as 2nd copy" creates copy 2', async ({ page }, testInfo) => {
  await signUp(page, `crate-${testInfo.project.name}`);
  for (const attempt of [1, 2]) {
    await page.goto('/albums/1');
    await page.getByRole('link', { name: 'Add to collection' }).click();
    await page.getByRole('button', { name: /Original press/ }).click();
    await page.getByRole('group', { name: 'Media condition (the vinyl)' }).getByRole('button', { name: /^NM/ }).click();
    await page.getByLabel('Paid ($)').fill('32');
    await page.getByRole('button', { name: 'Add to collection' }).click();
    if (attempt === 1) await expect(page.getByText('In your collection', { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('alert')).toContainText('You already own this pressing (1 copy).');
  await page.getByRole('button', { name: 'Add as 2nd copy' }).click();
  await expect(page.getByText('In your collection · copy 2')).toBeVisible();

  await page.goto('/collection?view=list');
  await expect(page.getByRole('row', { name: /Rumours/ })).toHaveCount(2);
  await expect(page.getByRole('cell', { name: 'Original press (copy 2)' })).toBeVisible();
  await page.goto('/albums/1');
  await expect(page.getByText('In your collection · 2 copies')).toBeVisible();
});

test('Collection rule 6: adding a copy takes the album off the wishlist; rule 2: only the pressing is required', async ({ page }, testInfo) => {
  await signUp(page, `rule6-${testInfo.project.name}`);
  await page.goto('/albums/1');
  await page.getByRole('button', { name: 'Add to wishlist' }).click();
  await expect(page.getByRole('button', { name: 'On wishlist' })).toBeVisible();

  await page.getByRole('link', { name: 'Add to collection' }).click();
  await page.getByRole('button', { name: /Original press/ }).click();
  await page.getByRole('button', { name: 'Add to collection' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Added to your collection. Rumours moved off your wishlist. Add the media and sleeve condition anytime below.');

  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Nothing on your wishlist yet' })).toBeVisible();
  await page.goto('/collection?view=list');
  await expect(page.getByRole('link', { name: 'Add condition: Rumours' })).toBeVisible();
});

test('every media and sleeve grade saves, edits and shows in the collection', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, `grades-${testInfo.project.name}`);
  await page.goto('/albums/1');
  await page.getByRole('link', { name: 'Add to collection' }).click();
  await page.getByRole('button', { name: /Original press/ }).click();
  await page.getByRole('button', { name: 'Add to collection' }).click();
  await expect(page.getByText('In your collection', { exact: true })).toBeVisible();
  const copyUrl = page.url();

  const grades = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'P'];
  for (const [i, media] of grades.entries()) {
    const sleeve = grades[grades.length - 1 - i];  // each grade appears once on each side
    await page.goto(copyUrl);
    const pick = (group: string, grade: string) => page.getByRole('group', { name: group })
      .getByRole('button', { name: new RegExp(`^${grade.replace('+', '\\+')} \\(`) });
    await pick('Media condition (the vinyl)', media).click();
    await pick('Sleeve condition', sleeve).click();
    await page.getByRole('button', { name: 'Save my copy' }).click();
    await expect(page).toHaveURL(/\/collection$/);
    await page.goto('/collection?view=list');
    await expect(page.getByRole('row', { name: /Rumours/ }).getByRole('cell', { name: `${media} / ${sleeve}`, exact: true })).toBeVisible();
  }
});
