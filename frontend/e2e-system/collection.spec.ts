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
