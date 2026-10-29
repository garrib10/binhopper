import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OtherShopCard, StoreCard } from './StoreCard';
import type { NearbyStore, OtherShop } from '../api';

it('AC-05 stale shop has a callable phone and directions without an origin location', () => {
  const store: NearbyStore = { listing_id: 1, store_id: 1, store_name: 'Fixture', area: 'Town',
    distance_mi: 4, pressing_id: 1, pressing_note: null, price: 20, condition: 'VG+', quantity: 1,
    freshness: 'out_of_date', last_updated_at: null, lat: 41, lng: -72, phone: '+1 (203) 555-0101' };
  render(<MemoryRouter><ol><StoreCard store={store} index={0} /></ol></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Call to confirm' })).toHaveAttribute('href', 'tel:+12035550101');
  expect(screen.getByRole('link', { name: 'Directions to Fixture' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=41,-72');
});

it('AC-17 a shop without online inventory shows call and directions but no price or stock', () => {
  const shop: OtherShop = { store_id: 9, name: 'Side B', area: 'Hoboken, NJ', distance_mi: 1.6,
    phone: '(201) 555-0142', lat: 40.744, lng: -74.0324 };
  const { container } = render(<MemoryRouter><ul><OtherShopCard shop={shop} albumId={1} /></ul></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Side B' })).toBeVisible();
  expect(screen.getByText('1.6 mi · Hoboken, NJ')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Call to check' })).toHaveAttribute('href', 'tel:2015550142');
  expect(screen.getByRole('link', { name: 'Directions to Side B' })).toBeVisible();
  expect(container.textContent).not.toMatch(/\$|in stock/);
});

it('AC-17 with no phone there is no call link', () => {
  render(<MemoryRouter><ul><OtherShopCard albumId={1} shop={{ store_id: 9, name: 'No phone', area: null, distance_mi: 3,
    phone: null, lat: 41, lng: -72 }} /></ul></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'Call to check' })).toBeNull();
  expect(screen.getByText('No online inventory: stop by to check')).toBeVisible();
});

const base: NearbyStore = { listing_id: 2, store_id: 2, store_name: 'Groove Merchant', area: 'Montclair', distance_mi: 21.4,
  pressing_id: 1, pressing_note: null, price: 28, condition: 'New', quantity: 3, freshness: 'current', last_updated_at: null,
  lat: 40.8, lng: -74.2, phone: '+1 973 555 0101' };
const NOW_MS = Date.parse('2026-10-28T12:00:00Z');

it('StaleStock: an out-of-date listing says how old it is, marks the price and asks "I checked it"', () => {
  render(<MemoryRouter><ol><StoreCard now={NOW_MS} index={0} store={{ ...base, freshness: 'out_of_date', last_updated_at: '2026-10-19T12:00:00' }} /></ol></MemoryRouter>);
  expect(screen.getByText('May be out of date: stock last updated 9 days ago. It may have sold. Call before you make the trip.')).toBeVisible();
  expect(screen.getByText('(price may have changed)')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Call to confirm' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'I checked it: Groove Merchant' })).toHaveAttribute('href', '/stock/2/report');
});

it('StaleStock: verified says when, and reported-missing says how many people', () => {
  render(<MemoryRouter><ol>
    <StoreCard now={NOW_MS} index={0} store={{ ...base, freshness: 'verified', last_updated_at: '2026-10-28T10:00:00' }} />
    <StoreCard now={NOW_MS} index={1} store={{ ...base, listing_id: 3, freshness: 'reported_missing', missing_reports: 2 }} />
  </ol></MemoryRouter>);
  expect(screen.getByText('Verified on the shelf 2 hr ago')).toBeVisible();
  expect(screen.getByText("Reported missing today: 2 people didn't find it")).toBeVisible();
  expect(screen.getAllByRole('link', { name: /Report stock/ })).toHaveLength(2);
});
