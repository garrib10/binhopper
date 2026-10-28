import { expect, test } from '../test/fixtures';
import { PASSWORD, signUp } from '../test/system-account';

test('AC-13 AC-15 a new account is private; deleting it removes the data and the old sign-in', async ({ page }, testInfo) => {
  const email = await signUp(page, `leaving-${testInfo.project.name}`);
  await page.goto('/you/privacy');
  for (const area of ['My profile', 'My collection', 'My wishlist']) {
    await expect(page.getByRole('group', { name: area }).getByRole('button', { name: 'Only me' })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.goto('/albums/1');
  await page.getByRole('button', { name: 'Add to wishlist' }).click();
  await expect(page.getByRole('button', { name: 'On wishlist' })).toBeVisible();

  await page.goto('/you/privacy');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download all my data/ }).click();
  const data = JSON.parse(await (await download).createReadStream().then(async (stream) => {
    let text = '';
    for await (const chunk of stream) text += chunk;
    return text;
  }));
  expect(data.account.email).toBe(email);
  expect(data.wishlist.map((w: { album: string }) => w.album)).toEqual(['Rumours']);

  await page.getByRole('tab', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Delete account…' }).click();
  await page.getByRole('button', { name: 'Delete forever' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
});
