import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Copy } from '../collection';
import { ordinal } from '../collection';
import { AddCopyPage } from './AddCopyPage';
import { CollectionPage } from './CollectionPage';
import { OwnedPage } from './OwnedPage';

const copy: Copy = { id: 5, album: { id: 1, title: 'Rumours', year: 1977, cover_url: null, artist: { id: 1, name: 'Fleetwood Mac' } },
  pressing: { id: 11, note: '180g reissue', label: 'Warner Bros.', format: 'LP' }, copy_number: 1,
  media_grade: 'NM', sleeve_grade: 'VG+', price_paid: 26, bought_at: 'Spin Cycle Records', notes: null,
  added_at: '2026-10-22T12:00:00' };
const album = { id: 1, title: 'Rumours', artist: { id: 1, name: 'Fleetwood Mac' }, year: 1977, cover_url: null, label: null,
  store_count: 0, lowest_price: null, nearest_outside_mi: null, discogs_url: '', genres: [], tracklist: [], release_type: 'master',
  pressings: [{ id: 11, label: 'Warner Bros.', format: 'LP', variant_note: '180g reissue', exclusive_kind: null, exclusive_to: null },
    { id: 12, label: 'Warner Bros.', format: 'LP', variant_note: 'Original press', exclusive_kind: null, exclusive_to: null }] };

type Handler = (init?: RequestInit) => { status?: number; body?: unknown };
function api(routes: Record<string, Handler>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).split('?')[0]}`;
    const reply = routes[key]?.(init) ?? { status: 404, body: {} };
    const status = reply.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? {}), { status });
  });
}

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/collection" element={<CollectionPage />} />
    <Route path="/collection/add/:albumId" element={<AddCopyPage />} />
    <Route path="/collection/:id" element={<OwnedPage />} />
  </Routes></MemoryRouter>);
}

describe('Collection page', () => {
  it('shows stats, a grid by default, and switches sort and view', async () => {
    const fetch = api({ 'GET /api/me/collection': () => ({ body: { items: [copy, { ...copy, id: 6, copy_number: 2 }],
      stats: { records: 2, artists: 1, duplicates: 1, wishlist: 4 } } }) });
    renderAt('/collection');
    expect(await screen.findByRole('link', { name: /Rumours.*180g reissue · copy 2/ })).toHaveAttribute('href', '/collection/6');
    const stats = screen.getByText('Records').closest('dl')!;
    expect(within(stats).getByText('Wishlist').nextSibling).toHaveTextContent('4');
    expect(screen.getAllByText('NM / VG+')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/me/collection?sort=year', expect.anything()));
    await userEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('columnheader', { name: 'Media / Sleeve' })).toBeVisible();
    expect(screen.getByRole('row', { name: /Rumours Fleetwood Mac 180g reissue \(copy 2\)/ })).toBeVisible();
  });

  it('has an empty state', async () => {
    api({ 'GET /api/me/collection': () => ({ body: { items: [], stats: { records: 0, artists: 0, duplicates: 0, wishlist: 0 } } }) });
    renderAt('/collection');
    expect(await screen.findByRole('heading', { name: 'No records yet' })).toBeVisible();
  });
});

describe('Adding a copy', () => {
  it('AC-09 warns about an owned pressing and "Add as 2nd copy" creates copy 2', async () => {
    const posts: unknown[] = [];
    api({ 'GET /api/albums/1': () => ({ body: album }), 'POST /api/me/collection': (init) => {
      const body = JSON.parse(String(init?.body)); posts.push(body);
      return body.another_copy ? { status: 201, body: { ...copy, id: 9, copy_number: 2 } }
        : { status: 409, body: { detail: { message: 'You already own this pressing', copies: 1 } } };
    }, 'GET /api/me/collection/9': () => ({ body: { ...copy, id: 9, copy_number: 2, pressings: [] } }) });
    renderAt('/collection/add/1');
    await userEvent.click(await screen.findByRole('button', { name: /180g reissue/ }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Media condition (the vinyl)' })).getByRole('button', { name: 'NM (Near Mint)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to collection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already own this pressing (1 copy).');
    await userEvent.click(screen.getByRole('button', { name: 'Add as 2nd copy' }));
    expect(await screen.findByText('In your collection · copy 2')).toBeVisible();
    expect(posts).toEqual([
      { pressing_id: 11, media_grade: 'NM', sleeve_grade: null, price_paid: null, bought_at: null, notes: null, another_copy: false },
      { pressing_id: 11, media_grade: 'NM', sleeve_grade: null, price_paid: null, bought_at: null, notes: null, another_copy: true },
    ]);
  });

  it('asks for a pressing first', async () => {
    api({ 'GET /api/albums/1': () => ({ body: album }) });
    renderAt('/collection/add/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Add to collection' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose which pressing you have');
  });
});

describe('Your copy', () => {
  it('saves changes to grades, price and notes', async () => {
    const fetch = api({ 'GET /api/me/collection/5': () => ({ body: { ...copy, pressings: [{ id: 11, note: '180g reissue', detail: 'LP' }, { id: 12, note: 'Original press', detail: 'LP' }] } }),
      'PATCH /api/me/collection/5': () => ({ body: copy }), 'GET /api/me/collection': () => ({ body: { items: [], stats: { records: 0, artists: 0, duplicates: 0, wishlist: 0 } } }) });
    renderAt('/collection/5');
    expect(await screen.findByRole('button', { name: /180g reissue/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: 'Media condition (the vinyl)' })).getByRole('button', { name: 'NM (Near Mint)' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Original press/ }));
    await userEvent.clear(screen.getByLabelText('Paid ($)'));
    await userEvent.type(screen.getByLabelText('Paid ($)'), '$30');
    await userEvent.type(screen.getByLabelText('Notes'), 'Light crackle');
    await userEvent.click(screen.getByRole('button', { name: 'Save my copy' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/me/collection/5', expect.objectContaining({ method: 'PATCH',
      body: JSON.stringify({ pressing_id: 12, media_grade: 'NM', sleeve_grade: 'VG+', price_paid: 30, bought_at: 'Spin Cycle Records', notes: 'Light crackle' }) })));
  });

  it('removes a copy after confirming', async () => {
    const fetch = api({ 'GET /api/me/collection/5': () => ({ body: { ...copy, pressings: [] } }), 'DELETE /api/me/collection/5': () => ({ status: 204 }),
      'GET /api/me/collection': () => ({ body: { items: [], stats: { records: 0, artists: 0, duplicates: 0, wishlist: 0 } } }) });
    renderAt('/collection/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove from collection' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove copy' }));
    expect(await screen.findByRole('heading', { name: 'No records yet' })).toBeVisible();
    expect(fetch).toHaveBeenCalledWith('/api/me/collection/5', expect.objectContaining({ method: 'DELETE' }));
  });
});

it('names copies 2nd, 3rd, 4th, 11th, 21st', () => {
  expect([2, 3, 4, 11, 21].map(ordinal)).toEqual(['2nd', '3rd', '4th', '11th', '21st']);
});
