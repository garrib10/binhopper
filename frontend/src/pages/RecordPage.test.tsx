import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../AuthContext';
import { ASK_FOR_MS, pendingHandoffs, recordHandoff, type HandoffListing } from '../handoff';
import { WishlistProvider } from '../WishlistContext';
import { RecordPage } from './RecordPage';

const record: HandoffListing = { listing_id: 3,
  album: { id: 1, title: 'Rumours', year: 1977, artist: 'Fleetwood Mac', cover_url: null },
  pressing: { id: 12, note: '180g reissue', label: 'Warner Bros.', format: 'LP' },
  store: { id: 1, name: 'Spin Cycle Records', area: 'Chelsea', address: null, phone: '(212) 555-0101', website: 'https://spin.example', lat: 40.75, lng: -74 },
  price: 26, condition: 'New', quantity: 2, freshness: 'current', discogs_url: 'https://www.discogs.com/sell/item/987' };
const account = { id: 1, username: 'collector-1', email: 'a@example.com', email_verified: true, sign_in_methods: ['password'] };

function api(signedIn: boolean, gotIt?: (body: { another_copy: boolean }) => { status: number; body: unknown }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/auth/me') return new Response(JSON.stringify(signedIn ? account : {}), { status: signedIn ? 200 : 401 });
    if (url === '/api/me/wishlist/albums') return new Response(JSON.stringify({ album_ids: [1] }));
    if (url === '/api/listings/3') return new Response(JSON.stringify(record));
    if (url === '/api/me/collection/from-listing' && gotIt) {
      const reply = gotIt(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    }
    return new Response('{}', { status: 404 });
  });
}

function renderPage() {
  render(<MemoryRouter initialEntries={['/records/3']}><AuthProvider><WishlistProvider>
    <Routes><Route path="/records/:id" element={<RecordPage />} /></Routes>
  </WishlistProvider></AuthProvider></MemoryRouter>);
}

afterEach(() => localStorage.clear());

describe('Locate, hold or buy', () => {
  it('hands off to the shop: directions, call, website and the Discogs listing', async () => {
    api(true);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Rumours' })).toBeVisible();
    expect(screen.getByText('1977 · Warner Bros. · LP, 180g reissue')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=40.75,-74');
    expect(screen.getByRole('link', { name: 'Call store' })).toHaveAttribute('href', 'tel:2125550101');
    expect(screen.getByRole('link', { name: 'Shop website' })).toHaveAttribute('href', 'https://spin.example');
    expect(screen.getByRole('link', { name: 'Buy on Discogs' })).toHaveAttribute('href', 'https://www.discogs.com/sell/item/987');
    expect(screen.queryByRole('heading', { name: 'Got Rumours?' })).toBeNull();
  });

  it('AC-10 after a hand-off, "Got it?" adds it to the collection and off the wishlist', async () => {
    const calls: unknown[] = [];
    api(true, (body) => { calls.push(body); return { status: 201, body: { id: 9, removed_from_wishlist: true } }; });
    renderPage();
    await userEvent.click(await screen.findByRole('link', { name: 'Call store' }));
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Buy');
    await userEvent.click(screen.getByRole('button', { name: "It's on my shelf, add to collection" }));
    expect(await screen.findByRole('heading', { name: 'Added to your collection' })).toBeVisible();
    expect(screen.getByText(/Rumours moved off your wishlist/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Add details' })).toHaveAttribute('href', '/collection/9');
    expect(calls).toEqual([{ listing_id: 3, another_copy: false }]);
    expect(pendingHandoffs()).toEqual([]);  // answered: stop asking
  });

  it('AC-10 offers "Add as 2nd copy" when the pressing is already owned', async () => {
    api(true, (body) => body.another_copy ? { status: 201, body: { id: 10, removed_from_wishlist: false } }
      : { status: 409, body: { detail: { message: 'You already own this pressing', copies: 1 } } });
    recordHandoff({ listingId: 3, albumId: 1, albumTitle: 'Rumours', storeName: 'Spin Cycle Records' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: "It's on my shelf, add to collection" }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already own this pressing (1 copy).');
    await userEvent.click(screen.getByRole('button', { name: 'Add as 2nd copy' }));
    expect(await screen.findByText(/Rumours is in your collection/)).toBeVisible();
  });

  it('"No thanks" stops asking', async () => {
    api(true);
    recordHandoff({ listingId: 3, albumId: 1, albumTitle: 'Rumours', storeName: 'Spin Cycle Records' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'No thanks' }));
    expect(screen.queryByRole('heading', { name: 'Got Rumours?' })).toBeNull();
    expect(pendingHandoffs()).toEqual([]);
  });

  it('signed out, "Got it?" asks you to sign in', async () => {
    api(false);
    recordHandoff({ listingId: 3, albumId: 1, albumTitle: 'Rumours', storeName: 'Spin Cycle Records' });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Sign in to add it to your collection' }))
      .toHaveAttribute('href', '/sign-in?return_to=%2Frecords%2F3');
  });
});

it('remembers a hand-off for 7 days', () => {
  const start = Date.parse('2026-10-28T12:00:00Z');
  recordHandoff({ listingId: 3, albumId: 1, albumTitle: 'Rumours', storeName: 'Spin Cycle Records' }, start);
  expect(pendingHandoffs(start + ASK_FOR_MS - 1)).toHaveLength(1);
  expect(pendingHandoffs(start + ASK_FOR_MS)).toEqual([]);
});
