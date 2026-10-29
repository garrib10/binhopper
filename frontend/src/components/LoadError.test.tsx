import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import { OwnedPage } from '../pages/OwnedPage';
import { RecordPage } from '../pages/RecordPage';
import { describeLoadError, UNREACHABLE } from './LoadError';

describe('describeLoadError', () => {
  it('says "not found" plainly, keeps our own messages, and offers Try again only when it could help', () => {
    expect(describeLoadError(new ApiError(404, 'Listing not found'), 'Sold.')).toEqual({ message: 'Sold.', canRetry: false });
    expect(describeLoadError(new ApiError(429, 'Too many attempts. Try again in 1 minute.'), 'x'))
      .toEqual({ message: 'Too many attempts. Try again in 1 minute.', canRetry: false });
    expect(describeLoadError(new ApiError(502, '<html>Bad gateway</html>'), 'x')).toEqual({ message: UNREACHABLE, canRetry: true });
    expect(describeLoadError(new TypeError('Failed to fetch'), 'x')).toEqual({ message: UNREACHABLE, canRetry: true });
  });
});

function renderAt(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/records/:id" element={<RecordPage />} />
    <Route path="/collection/:id" element={<OwnedPage />} />
  </Routes></MemoryRouter>);
}

describe('pages recover from a failed load', () => {
  it('Try again loads the hold-or-buy page once the network is back', async () => {
    const record = { listing_id: 3, album: { id: 1, title: 'Rumours', year: 1977, artist: 'Fleetwood Mac', cover_url: null },
      pressing: { id: 12, note: null, label: null, format: 'LP' },
      store: { id: 1, name: 'Spin Cycle Records', area: null, address: null, phone: null, website: null, lat: 40.75, lng: -74 },
      price: 26, condition: 'New', quantity: 1, freshness: 'current', discogs_url: null };
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(new Response(JSON.stringify(record)));
    renderAt('/records/3');
    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE);
    expect(screen.queryByText('offline')).toBeNull();  // raw error text never shows
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Rumours' })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('a copy that is gone says so, with a way back and no Try again', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ detail: 'Copy not found' }), { status: 404 }));
    renderAt('/collection/9');
    expect(await screen.findByRole('alert')).toHaveTextContent('That copy isn’t in your collection.');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to collection' })).toHaveAttribute('href', '/collection');
  });
});
