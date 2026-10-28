import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '../test/fixtures';
import { SYSTEM_OUTBOX } from '../test/system-outbox';

/** The newest email the local API wrote for `to` (EMAIL_BACKEND=file). */
async function latestEmail(to: string, subject: string): Promise<{ text: string }> {
  let found: { text: string } | undefined;
  await expect.poll(async () => {
    const names = (await readdir(SYSTEM_OUTBOX).catch(() => [])).sort().reverse();
    for (const name of names) {
      const message = JSON.parse(await readFile(join(SYSTEM_OUTBOX, name), 'utf8'));
      if (message.to === to && message.subject === subject) { found = message; return true; }
    }
    return false;
  }, { timeout: 15_000 }).toBe(true);
  return found!;
}

function linkPath(email: { text: string }): string {
  const url = new URL(email.text.match(/https?:\/\/\S+#token=[\w-]+/)![0]);
  return url.pathname + url.hash;
}

// Each test looks like a different visitor (Vercel sets X-Forwarded-For), so re-running the
// suite against the same database stays under the per-IP sign-up limit.
async function asNewVisitor(page: Page) {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.${octet()}.${octet()}` });
}

test('AC-19 AC-21 real sign-up, emailed link, sign out, sign in, reset', async ({ page }, testInfo) => {
  await asNewVisitor(page);
  const email = `system-${Date.now()}-${testInfo.project.name}@example.com`;
  await page.goto('/create-account');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('spin-the-b-side');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto(linkPath(await latestEmail(email, 'Confirm your email for Binhopper')));
  await expect(page.getByRole('heading', { name: "You're signed in" })).toBeVisible();
  await page.goto('/you');
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await page.goto('/sign-in?return_to=%2Fwishlist');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('spin-the-b-side');
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
