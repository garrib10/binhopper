import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ago, parsePrice, type ReportableListing } from '../reports';
import { ReportPage } from './ReportPage';
import { SightingPage } from './SightingPage';

const listing: ReportableListing = { listing_id: 3, store: { id: 1, name: 'Spin Cycle Records' }, album: { id: 1, title: 'Rumours' },
  pressing_note: '180g reissue', price: 26, condition: 'New', quantity: 2, source: 'manual', freshness: 'current',
  last_updated_at: null, reported_today: false };

function api(routes: Record<string, (init?: RequestInit) => { status?: number; body?: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).split('?')[0]}`;
    const reply = routes[key]?.(init) ?? { status: 404, body: {} };
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200 });
  });
}

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/stock/:id/report" element={<ReportPage />} />
    <Route path="/stores/:id/report" element={<SightingPage />} />
  </Routes></MemoryRouter>);
}

describe('Report stock', () => {
  it('sends "Yes, it’s there" and thanks the user', async () => {
    const fetch = api({ 'GET /api/stock/3': () => ({ body: listing }), 'POST /api/stock/3/reports': () => ({ status: 201, body: { listing_id: 3 } }) });
    renderAt('/stock/3/report');
    expect(await screen.findByText(/Listed: 180g reissue · New · \$26\.00 · 2 in stock/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, it’s there' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('status')).toHaveTextContent('verified for the next 24 hours');
    expect(fetch).toHaveBeenCalledWith('/api/stock/3/reports', expect.objectContaining({ body: JSON.stringify({ result: 'present', reported_price: null }) }));
  });

  it('asks for the sticker price with "Different price"', async () => {
    const fetch = api({ 'GET /api/stock/3': () => ({ body: listing }), 'POST /api/stock/3/reports': () => ({ status: 201, body: {} }) });
    renderAt('/stock/3/report');
    await userEvent.click(await screen.findByRole('button', { name: 'Different price' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the price on the sticker');
    await userEvent.type(screen.getByLabelText('Price on the sticker ($)'), '$29');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('status')).toHaveTextContent('show your price');
    expect(fetch).toHaveBeenCalledWith('/api/stock/3/reports', expect.objectContaining({ body: JSON.stringify({ result: 'different_price', reported_price: 29 }) }));
  });

  it('AC-07 says when you already reported today', async () => {
    api({ 'GET /api/stock/3': () => ({ body: listing }), 'POST /api/stock/3/reports': () => ({ status: 429, body: { detail: 'You already reported this today' } }) });
    renderAt('/stock/3/report');
    await userEvent.click(await screen.findByRole('button', { name: 'Not on the shelf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already reported this today');
  });

  it('AC-07 a listing already reported today opens closed', async () => {
    api({ 'GET /api/stock/3': () => ({ body: { ...listing, reported_today: true } }) });
    renderAt('/stock/3/report');
    expect(await screen.findByText('You already reported this today. Thanks!')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Yes, it’s there' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });
});

describe('I saw it here', () => {
  const form = { store: { id: 9, name: 'Side B', area: 'Hoboken, NJ' }, album: { id: 1, title: 'Rumours', artist: 'Fleetwood Mac' },
    pressings: [{ id: 11, note: 'Original press', detail: 'LP' }, { id: 12, note: '180g reissue', detail: 'LP' }] };

  it('AC-18 adds the shop to nearby stock with pressing, condition and price', async () => {
    const fetch = api({ 'GET /api/stores/9/sighting': () => ({ body: form }), 'POST /api/stores/9/sightings': () => ({ status: 201, body: { listing_id: 4 } }) });
    renderAt('/stores/9/report?album=1');
    await userEvent.click(await screen.findByRole('button', { name: /Original press/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Used' }));
    await userEvent.type(screen.getByLabelText('Price on the sticker ($)'), '22');
    await userEvent.click(screen.getByRole('button', { name: 'Add to nearby stock' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Side B now shows Rumours in nearby stock');
    expect(fetch).toHaveBeenCalledWith('/api/stores/9/sightings', expect.objectContaining({
      body: JSON.stringify({ album_id: 1, pressing_id: 11, condition: 'Used', price: 22 }) }));
  });

  it('needs every field before sending', async () => {
    const fetch = api({ 'GET /api/stores/9/sighting': () => ({ body: form }) });
    renderAt('/stores/9/report?album=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Add to nearby stock' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose which pressing you saw');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

it('formats the listing age and parses sticker prices', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  expect(ago('2026-10-28T06:00:00', now)).toBe('updated 6 hr ago');
  expect(ago('2026-10-25T12:00:00', now)).toBe('updated 3 days ago');
  expect([parsePrice('$29'), parsePrice('24.50'), parsePrice(''), parsePrice('0'), parsePrice('abc')]).toEqual([29, 24.5, null, null, null]);
});
