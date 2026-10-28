import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from './fixtures';
import { SYSTEM_OUTBOX } from './system-outbox';

/** The newest email the local API wrote for `to` (EMAIL_BACKEND=file). */
export async function latestEmail(to: string, subject: string): Promise<{ text: string }> {
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

/** The path + #token of the link in an email, to open on the app under test. */
export function linkPath(email: { text: string }): string {
  const url = new URL(email.text.match(/https?:\/\/\S+#token=[\w-]+/)![0]);
  return url.pathname + url.hash;
}

// Each test looks like a different visitor (Vercel sets X-Forwarded-For), so re-running the
// suite against the same database stays under the per-IP sign-up limit.
export async function asNewVisitor(page: Page) {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.${octet()}.${octet()}` });
}

export const PASSWORD = 'spin-the-b-side';

/** Create a real account through the UI and open its emailed link: the page ends signed in. */
export async function signUp(page: Page, label: string): Promise<string> {
  await asNewVisitor(page);
  const email = `system-${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}@example.com`;
  await page.goto('/create-account');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.goto(linkPath(await latestEmail(email, 'Confirm your email for Binhopper')));
  await expect(page.getByRole('heading', { name: "You're signed in" })).toBeVisible();
  return email;
}
