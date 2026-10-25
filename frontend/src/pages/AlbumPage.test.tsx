import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AlbumPage } from './AlbumPage';

const album = { id: 1, title: 'Rumours', artist: { id: 7, name: 'Fleetwood Mac' }, year: 1977,
  label: 'Warner Bros.', cover_url: null, genres: ['Rock'], tracklist: [{ position: 'A1', title: 'Dreams' }],
  store_count: 2, lowest_price: 18, nearest_outside_mi: null, discogs_url: 'https://www.discogs.com/master/1',
  pressings: [{ id: 1, label: 'Warner Bros.', format: 'LP', variant_note: 'Gold vinyl', exclusive_kind: 'artist', exclusive_to: 'Official artist store' },
    { id: 2, label: 'Warner Bros.', format: 'LP', variant_note: 'Clear vinyl', exclusive_kind: 'retailer', exclusive_to: 'A shop' }] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
function open() { render(<MemoryRouter initialEntries={['/albums/1']}><Routes><Route path="/albums/:id" element={<AlbumPage />} /></Routes></MemoryRouter>); }
it('shows side positions, real artist/store/listen links and both exclusive kinds', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(album)));
  open();
  await screen.findByRole('heading', { name: 'Rumours' });
  expect(screen.getByRole('heading', { name: 'Side A' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Fleetwood Mac' })).toHaveAttribute('href', '/artists/7');
  expect(screen.getByRole('link', { name: /Find in stores/ })).toHaveAttribute('href', '/albums/1/stores');
  expect(screen.getByRole('link', { name: 'Spotify' }).getAttribute('href')).toContain('Fleetwood%20Mac%20Rumours');
  fireEvent.click(screen.getByRole('button', { name: /Pressings/ }));
  expect(screen.getByText('Artist store exclusive')).toBeVisible();
  expect(screen.getByText('Retailer exclusive')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Data provided by Discogs.' }).getAttribute('rel')).not.toContain('nofollow');
});
it('provides a recoverable API error', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach Binhopper right now.");
  expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
});
