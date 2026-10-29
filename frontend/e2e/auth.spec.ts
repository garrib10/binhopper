import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';

const account = { id: 1, username: 'collector-abc123', email: 'collector@example.com',
  email_verified: true, sign_in_methods: ['password'] };

/** A fake sign-in API: remembers whether this browser is signed in. */
async function fakeAuthApi(page: Page) {
  const state = { signedIn: false, csrf: [] as (string | undefined)[] };
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST') state.csrf.push(request.headers()['x-binhopper-csrf']);
    const json = (status: number, body: unknown) => route.fulfill({ status, json: body });
    switch (path) {
      case '/api/auth/me': return state.signedIn ? json(200, account) : json(401, { detail: 'Not signed in' });
      case '/api/auth/providers': return json(200, { google: false });
      case '/api/auth/register': return json(202, { detail: 'Check your email for a link to finish signing up.' });
      case '/api/auth/forgot-password': return json(202, { detail: "If that email has a Binhopper account, we've sent a link to reset the password." });
      case '/api/auth/verify':
      case '/api/auth/reset-password':
        state.signedIn = true; return json(200, account);
      case '/api/auth/sign-in': {
        const { password } = request.postDataJSON();
        if (password !== 'spin-the-b-side') return json(401, { detail: 'Email or password is incorrect' });
        state.signedIn = true; return json(200, account);
      }
      default: return json(404, {});
    }
  });
  return state;
}

for (const theme of ['light', 'dark'] as const) {
  test(`AC-19 create an account, open the emailed link, signed in (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const api = await fakeAuthApi(page);
    await page.goto('/search');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByLabel('Email').fill('collector@example.com');
    await page.getByLabel('Password', { exact: true }).fill('spin-the-b-side');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText('collector@example.com')).toBeVisible();

    await page.goto('/verify#token=emailed-token');
    await expect(page.getByRole('heading', { name: "You're signed in" })).toBeVisible();
    await expect(page).toHaveURL(/\/verify$/); // the token is gone from the address bar
    await expect(page.getByRole('link', { name: 'You: account and settings' })).toBeVisible();
    expect(api.csrf.every((value) => value === '1')).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('AC-20 a wrong password shows one message; protected pages return after sign-in', async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto('/collection');
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Fcollection$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel('Email').fill('collector@example.com');
  await page.getByLabel('Password', { exact: true }).fill('not-my-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
  await page.getByLabel('Password', { exact: true }).fill('spin-the-b-side');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Collection', exact: true })).toBeVisible();
  await page.route('**/api/me/settings', (route) => route.fulfill({ json: { username: 'collector-abc123', email: 'collector@example.com',
    sign_in_methods: ['password'], home_zip: null, default_radius_mi: 25, theme: 'system', use_current_location: false,
    privacy_profile: 'private', privacy_collection: 'private', privacy_wishlist: 'private', favorite_genres: [], genres: ['Rock'] } }));
  await page.getByRole('link', { name: 'You: account and settings' }).click();
  await page.getByRole('tab', { name: 'Account' }).click();
  await expect(page.getByText('collector@example.com')).toBeVisible();
});

test('AC-21 forgot password, then choose a new one from the emailed link', async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto('/sign-in');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email').fill('collector@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText("we've sent a link");
  await page.goto('/reset-password#token=reset-token');
  await page.getByLabel('New password', { exact: true }).fill('a-brand-new-pass');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
  await expect(page.getByText('Anywhere else you were signed in has been signed out.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('sign-in controls meet the 44 px touch target', async ({ page }) => {
  await fakeAuthApi(page);
  await page.goto('/sign-in');
  for (const control of [page.getByLabel('Email'), page.getByRole('button', { name: 'Sign in' }),
    page.getByRole('button', { name: 'Show password' }), page.getByRole('link', { name: 'Forgot password?' })]) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  }
});
