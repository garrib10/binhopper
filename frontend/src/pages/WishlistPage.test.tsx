import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../AuthContext';
import { HeartButton } from '../components/HeartButton';
import { wantText, type WishlistItem } from '../wishlist';
import { WishlistProvider } from '../WishlistContext';
import { WishlistPage } from './WishlistPage';

const account = { id: 1, username: 'collector-1', email: 'a@example.com', email_verified: true, sign_in_methods: ['password'] };
const rumours: WishlistItem = {
  id: 7, album: { id: 1, title: 'Rumours', year: 1977, cover_url: null, artist: { id: 1, name: 'Fleetwood Mac' } },
  pressing_id: null, pressing_note: null, max_price: 35, min_condition: null,
  pressings: [{ id: 11, note: 'Original press' }, { id: 12, note: '180g reissue' }],
  store_count: 3, nearest: { store_name: 'Spin Cycle Records', distance_mi: 3.2, price: 26 },
  cheapest: { store_name: 'Second Pressing', distance_mi: 8.7, price: 24 }, nearest_outside_mi: null,
};
const blue: WishlistItem = { ...rumours, id: 8, album: { ...rumours.album, id: 2, title: 'Blue', artist: { id: 2, name: 'Joni Mitchell' } },
  max_price: null, store_count: 0, nearest: null, cheapest: null, nearest_outside_mi: 38 };

/** Fake API by method + path. */
function api(routes: Record<string, (init?: RequestInit) => unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).split('?')[0]}`;
    const handler = routes[key];
    if (!handler) return new Response('{}', { status: key === 'GET /api/auth/me' ? 401 : 404 });
    const body = await handler(init);
    return body === null ? new Response(null, { status: 204 }) : new Response(JSON.stringify(body), { status: 200 });
  });
}

function renderSignedIn(ui: React.ReactNode) {
  return render(<MemoryRouter><AuthProvider><WishlistProvider>{ui}</WishlistProvider></AuthProvider></MemoryRouter>);
}

describe('Wishlist page', () => {
  it('shows in-stock and out-of-stock records the way the mockup does', async () => {
    api({ 'GET /api/auth/me': () => account, 'GET /api/me/wishlist': () => ({ items: [rumours, blue] }),
      'GET /api/me/wishlist/albums': () => ({ album_ids: [1, 2] }) });
    renderSignedIn(<WishlistPage />);
    const [first, second] = await screen.findAllByRole('listitem');
    expect(screen.getByText('2 records')).toBeVisible();
    expect(within(first).getByText('Wants: Any pressing · under $35')).toBeVisible();
    expect(within(first).getByText('3 stores in range')).toBeVisible();
    expect(within(first).getByText('Nearest: Spin Cycle Records · 3.2 mi · $26')).toBeVisible();
    expect(within(first).getByText('Cheapest: Second Pressing · 8.7 mi · $24')).toBeVisible();
    expect(within(first).getByRole('link', { name: 'Find it: Rumours' })).toHaveAttribute('href', '/albums/1/stores');
    expect(within(second).getByText('None within 25 mi')).toBeVisible();
    expect(within(second).getByText('Closest copy is 38 mi away')).toBeVisible();
  });

  it('saves a pressing, price cap and minimum condition (rule 2)', async () => {
    const fetch = api({ 'GET /api/auth/me': () => account, 'GET /api/me/wishlist': () => ({ items: [rumours] }),
      'PATCH /api/me/wishlist/7': () => ({ id: 7 }) });
    renderSignedIn(<WishlistPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Change what you want' }));
    await userEvent.selectOptions(screen.getByLabelText('Pressing'), '11');
    await userEvent.clear(screen.getByLabelText('Max price ($)'));
    await userEvent.type(screen.getByLabelText('Max price ($)'), '30');
    await userEvent.selectOptions(screen.getByLabelText('Minimum condition'), 'VG+');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/me/wishlist/7', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ pressing_id: 11, max_price: 30, min_condition: 'VG+' }) })));
  });

  it('shows placeholder cards on the first load, not an empty page', async () => {
    api({ 'GET /api/auth/me': () => account, 'GET /api/me/wishlist': () => new Promise(() => {}) });
    renderSignedIn(<WishlistPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Loading your wishlist…');
    expect(document.querySelectorAll('.list-placeholder__item')).toHaveLength(3);
    expect(screen.queryByRole('listitem')).toBeNull();  // the placeholders are hidden from screen readers
  });

  it('takes a removed record off at once, without waiting for the refresh', async () => {
    let removed = false;  // the refresh after removing never answers, so only the local change can show
    api({ 'GET /api/auth/me': () => account, 'GET /api/me/wishlist/albums': () => ({ album_ids: [1, 2] }),
      'GET /api/me/wishlist': () => (removed ? new Promise(() => {}) : { items: [rumours, blue] }),
      'DELETE /api/me/wishlist/8': () => { removed = true; return null; } });
    renderSignedIn(<WishlistPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Blue from wishlist' }));
    await waitFor(() => expect(screen.queryByText('Blue')).toBeNull());
    expect(screen.getByText('1 record')).toBeVisible();
  });

  it('shows the empty state', async () => {
    api({ 'GET /api/auth/me': () => account, 'GET /api/me/wishlist': () => ({ items: [] }) });
    renderSignedIn(<WishlistPage />);
    expect(await screen.findByRole('heading', { name: 'Nothing on your wishlist yet' })).toBeVisible();
  });
});

describe('Heart', () => {
  it('AC-08 adds then removes, saving each tap', async () => {
    const fetch = api({ 'GET /api/auth/me': () => account, 'GET /api/me/wishlist/albums': () => ({ album_ids: [] }),
      'POST /api/me/wishlist': () => ({ id: 7 }), 'DELETE /api/me/wishlist': () => null });
    renderSignedIn(<HeartButton albumId={1} title="Rumours" />);
    const heart = await screen.findByRole('button', { name: 'Add Rumours to wishlist' });
    await userEvent.click(heart);
    expect(await screen.findByRole('button', { name: 'Remove Rumours from wishlist' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Rumours from wishlist' }));
    expect(await screen.findByRole('button', { name: 'Add Rumours to wishlist' })).toHaveAttribute('aria-pressed', 'false');
    const writes = fetch.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET').map(([url, init]) => `${init!.method} ${url}`);
    expect(writes).toEqual(['POST /api/me/wishlist', 'DELETE /api/me/wishlist?album_id=1']);
  });

  it('AC-08 a tap made while saved hearts are still loading is kept', async () => {
    let finishLoading: (r: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const key = `${init?.method ?? 'GET'} ${String(input).split('?')[0]}`;
      if (key === 'GET /api/auth/me') return new Response(JSON.stringify(account));
      if (key === 'GET /api/me/wishlist/albums') return new Promise<Response>((resolve) => { finishLoading = resolve; });
      return new Response(JSON.stringify({ id: 7 }), { status: 201 });
    });
    renderSignedIn(<HeartButton albumId={1} title="Rumours" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add Rumours to wishlist' }));
    await act(async () => {
      finishLoading(new Response(JSON.stringify({ album_ids: [] })));  // loaded before the save landed
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('button', { name: /Rumours/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('goes back to the previous state if saving fails', async () => {
    api({ 'GET /api/auth/me': () => account, 'GET /api/me/wishlist/albums': () => ({ album_ids: [] }) });
    renderSignedIn(<HeartButton albumId={1} title="Rumours" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add Rumours to wishlist' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update your wishlist");
    expect(screen.getByRole('button', { name: 'Add Rumours to wishlist' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('signed out, it asks you to sign in and saves nothing', async () => {
    const fetch = api({});
    render(<MemoryRouter initialEntries={['/albums/1']}><AuthProvider><WishlistProvider>
      <HeartButton albumId={1} title="Rumours" /></WishlistProvider></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Sign in to save Rumours to your wishlist' }))
      .toHaveAttribute('href', '/sign-in?return_to=%2Falbums%2F1');
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/me/wishlist'))).toBe(false);
  });
});

it('describes what an item wants', () => {
  expect(wantText({ pressing_note: null, min_condition: null, max_price: null })).toBe('Any pressing');
  expect(wantText({ pressing_note: 'Original press', min_condition: 'VG+', max_price: 24.5 }))
    .toBe('Original press · VG+ or better · under $24.50');
});
