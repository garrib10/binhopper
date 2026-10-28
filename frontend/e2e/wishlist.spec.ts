import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';

const account = { id: 1, username: 'collector-1', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };
const album = { id: 1, title: 'Rumours', artist: { id: 1, name: 'Fleetwood Mac' }, year: 1977, cover_url: null,
  label: 'Warner Bros.', store_count: 4, lowest_price: 18, nearest_outside_mi: null, discogs_url: 'https://www.discogs.com/master/1',
  genres: ['Rock'], tracklist: [{ position: 'A1', title: 'Second Hand News' }], release_type: 'master', pressings: [] };

/** A signed-in fake API that remembers the wishlist across reloads. */
async function fakeApi(page: Page) {
  const wished = new Set<number>();
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
  await page.route('**/api/albums/1?*', (route) => route.fulfill({ json: album }));
  await page.route('**/api/me/wishlist**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/me/wishlist/albums') return route.fulfill({ json: { album_ids: [...wished] } });
    if (request.method() === 'POST') { wished.add(request.postDataJSON().album_id); return route.fulfill({ status: 201, json: { id: 7 } }); }
    if (request.method() === 'DELETE') { wished.delete(Number(url.searchParams.get('album_id'))); return route.fulfill({ status: 204 }); }
    return route.fulfill({ json: { items: [...wished].map((id) => ({
      id: 7, album: { id, title: 'Rumours', year: 1977, cover_url: null, artist: { id: 1, name: 'Fleetwood Mac' } },
      pressing_id: null, pressing_note: null, max_price: null, min_condition: null, pressings: [],
      store_count: 3, nearest: { store_name: 'Spin Cycle Records', distance_mi: 3.2, price: 26 },
      cheapest: { store_name: 'Second Pressing', distance_mi: 8.7, price: 24 }, nearest_outside_mi: null })) } });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`AC-08 heart twice adds then removes, and a reload shows the final state (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await fakeApi(page);
    await page.goto('/albums/1');
    await page.getByRole('button', { name: 'Add to wishlist' }).click();
    await expect(page.getByRole('button', { name: 'On wishlist' })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'On wishlist' })).toBeVisible();

    await page.getByRole('link', { name: 'Wishlist' }).first().click();
    await expect(page.getByRole('heading', { name: 'Rumours' })).toBeVisible();
    await expect(page.getByText('3 stores in range')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find it: Rumours' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goBack();
    await page.getByRole('button', { name: 'On wishlist' }).click();
    await expect(page.getByRole('button', { name: 'Add to wishlist' })).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Add to wishlist' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('signed out, the heart sends you to sign in and back', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/albums/1?*', (route) => route.fulfill({ json: album }));
  await page.goto('/albums/1');
  await page.getByRole('link', { name: 'Sign in to save' }).click();
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Falbums%2F1$/);
});
