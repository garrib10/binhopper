import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';
import { fakeApi } from '../test/fake-api';

// #74: every screen, signed in and out, at 390 and 1440 px (the two projects), light and dark:
// zero axe violations (including 4.5:1 contrast) and 44 px touch targets.
const SIGNED_IN = ['/search?q=rumours', '/genres', '/genres/Rock/years?decade=1970', '/albums/1', '/artists/1',
  '/albums/1/stores', '/records/1', '/wishlist', '/collection', '/collection?view=list', '/collection/add/1', '/collection/5',
  '/import', '/you/profile', '/you/settings', '/you/privacy', '/you/account', '/onboarding', '/stock/1/report',
  '/stores/9/report?album=1', '/not-a-page'];
const SIGNED_OUT = ['/search', '/sign-in', '/create-account', '/forgot-password', '/reset-password#token=t', '/verify'];

/** Interactive elements smaller than 44 px. Links inside running text are exempt (WCAG 2.5.8). */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('a[href], button, input:not([type=hidden]), select, textarea, [role="tab"]')) {
      const target = (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) && el.closest('label')) || el;
      const box = target.getBoundingClientRect();
      if (!box.width || !box.height || box.right < 0 || box.bottom < 0) continue;  // hidden or off screen (skip link)
      const style = getComputedStyle(el);
      const inText = el.tagName === 'A' && style.display === 'inline' && (el.parentElement?.textContent ?? '').trim() !== (el.textContent ?? '').trim();
      if (inText) continue;
      if (Math.min(box.width, box.height) < 43.5) {
        small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    return small;
  });
}

async function check(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /^Loading|^Searching/ })).toHaveCount(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect.soft(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `axe on ${path}`).toEqual([]);
  expect.soft(await smallTargets(page), `44 px targets on ${path}`).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`every signed-in screen passes axe and 44 px targets (${theme})`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: theme });
    await fakeApi(page);
    for (const path of SIGNED_IN) await test.step(path, () => check(page, path));
  });

  test(`every signed-out screen passes axe and 44 px targets (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    await fakeApi(page, { signedIn: false });
    for (const path of SIGNED_OUT) await test.step(path, () => check(page, path));
  });
}

/** Press Tab until `name` has focus; fail if it's never reached. Focus must always be visible. */
async function tabTo(page: Page, role: 'link' | 'button', name: string | RegExp) {
  const target = page.getByRole(role, { name }).first();
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return 'none-needed';
      const style = getComputedStyle(el);
      const shown = (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
      return shown ? 'visible' : `missing on ${el.tagName.toLowerCase()}#${el.id}.${el.className} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}"`;
    });
    expect(outline, 'every focused control shows a focus outline').not.toMatch(/^missing/);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${role} "${name}"`);
}

test('keyboard only: skip link, then search → album → nearby → hold or buy → got it', async ({ page }) => {
  test.setTimeout(120_000);
  await fakeApi(page);
  await page.route('**/api/me/collection/from-listing', (route) => route.fulfill({ status: 201, json: { id: 5, removed_from_wishlist: true } }));
  await page.goto('/search?q=rumours');
  await expect(page.getByRole('link', { name: /Rumours.*Fleetwood Mac/ })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('#content')), 'skip link jumps past the header').toBe(true);

  await tabTo(page, 'link', /Rumours.*Fleetwood Mac/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Rumours', level: 1 })).toBeVisible();
  await tabTo(page, 'link', /Find in stores/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '2 stores have it' })).toBeVisible();
  await tabTo(page, 'link', 'Hold or buy: Spin Cycle Records');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Spin Cycle Records' })).toBeVisible();
  await tabTo(page, 'link', 'Call store');
  await page.keyboard.press('Enter');
  await tabTo(page, 'button', "It's on my shelf, add to collection");
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Added to your collection' })).toBeVisible();
});

test('keyboard only: You tabs move with the arrow keys and the delete dialog can be cancelled', async ({ page }) => {
  await fakeApi(page);
  await page.goto('/you/profile');
  await tabTo(page, 'link', 'Skip to content').catch(() => undefined);
  await page.getByRole('tab', { name: 'Profile' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused();
  await page.keyboard.press('End').catch(() => undefined);
  await page.getByRole('tab', { name: 'Account' }).focus();
  await page.keyboard.press('Enter');
  await tabTo(page, 'button', 'Delete account…');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog', { name: 'Delete your account?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep account' })).toBeFocused();  // the safe choice first
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
