import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../test/fixtures';

const account = { id: 1, username: 'collector-1', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };
const album = { id: 1, title: 'Rumours', artist: { id: 1, name: 'Fleetwood Mac' }, year: 1977, cover_url: null, label: 'Warner Bros.',
  store_count: 4, lowest_price: 18, nearest_outside_mi: null, discogs_url: 'https://www.discogs.com/master/1', genres: ['Rock'],
  tracklist: [], release_type: 'master', pressings: [
    { id: 11, label: 'Warner Bros.', format: 'LP', variant_note: 'Original press', exclusive_kind: null, exclusive_to: null },
    { id: 12, label: 'Warner Bros.', format: 'LP', variant_note: '180g reissue', exclusive_kind: null, exclusive_to: null }] };

/** A signed-in fake collection API that enforces the duplicate rule like the real one. */
async function fakeApi(page: Page) {
  const copies: { id: number; pressing_id: number; media_grade: string | null; sleeve_grade: string | null }[] = [];
  const view = (c: (typeof copies)[number]) => ({ ...c, album: { ...album, artist: album.artist },
    pressing: { id: c.pressing_id, note: c.pressing_id === 11 ? 'Original press' : '180g reissue', label: 'Warner Bros.', format: 'LP' },
    copy_number: copies.filter((o) => o.pressing_id === c.pressing_id && o.id <= c.id).length,
    price_paid: null, bought_at: null, notes: null, added_at: '2026-10-28T12:00:00',
    pressings: album.pressings.map((p) => ({ id: p.id, note: p.variant_note, detail: 'Warner Bros. · LP' })) });
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: account }));
  await page.route('**/api/me/wishlist/albums', (route) => route.fulfill({ json: { album_ids: [] } }));
  await page.route('**/api/albums/1?*', (route) => route.fulfill({ json: album }));
  await page.route('**/api/albums/1', (route) => route.fulfill({ json: album }));
  await page.route('**/api/me/collection**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/me/collection/owned') return route.fulfill({ json: { copies: {} } });
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      const owned = copies.filter((c) => c.pressing_id === body.pressing_id).length;
      if (owned && !body.another_copy) return route.fulfill({ status: 409, json: { detail: { message: 'You already own this pressing', copies: owned } } });
      const copy = { id: copies.length + 1, pressing_id: body.pressing_id, media_grade: body.media_grade, sleeve_grade: body.sleeve_grade };
      copies.push(copy);
      return route.fulfill({ status: 201, json: view(copy) });
    }
    const id = Number(path.split('/').pop());
    if (id) return route.fulfill({ json: view(copies.find((c) => c.id === id)!) });
    return route.fulfill({ json: { items: copies.map(view).reverse(),
      stats: { records: copies.length, artists: copies.length ? 1 : 0, duplicates: Math.max(0, copies.length - 1), wishlist: 0 } } });
  });
}

async function addOriginalPress(page: Page) {
  await page.goto('/albums/1');
  await page.getByRole('link', { name: 'Add to collection' }).click();
  await page.getByRole('button', { name: /Original press/ }).click();
  await page.getByRole('group', { name: 'Media condition (the vinyl)' }).getByRole('button', { name: /^VG\+/ }).click();
  await page.getByRole('button', { name: 'Add to collection' }).click();
}

for (const theme of ['light', 'dark'] as const) {
  test(`AC-09 an owned pressing warns and "Add as 2nd copy" creates copy 2 (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await fakeApi(page);
    await addOriginalPress(page);
    await expect(page.getByText('In your collection', { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await addOriginalPress(page);
    await expect(page.getByRole('alert')).toContainText('You already own this pressing');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Add as 2nd copy' }).click();
    await expect(page.getByText('In your collection · copy 2')).toBeVisible();

    await page.goto('/collection');
    await expect(page.getByRole('link', { name: /Rumours.*copy 2/ })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByRole('columnheader', { name: 'Media / Sleeve' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('grade chips and pressing choices meet the 44 px touch target', async ({ page }) => {
  await fakeApi(page);
  await page.goto('/collection/add/1');
  for (const control of await page.getByRole('group', { name: 'Sleeve condition' }).getByRole('button').all()) {
    const box = (await control.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});
