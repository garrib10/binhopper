import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { OtherShopCard, StoreCard } from './StoreCard';
import type { NearbyStore, OtherShop } from '../api';

it('AC-05 stale shop has a callable phone and directions without an origin location', () => {
  const store: NearbyStore = { listing_id: 1, store_id: 1, store_name: 'Fixture', area: 'Town',
    distance_mi: 4, pressing_id: 1, pressing_note: null, price: 20, condition: 'VG+', quantity: 1,
    freshness: 'out_of_date', last_updated_at: null, lat: 41, lng: -72, phone: '+1 (203) 555-0101' };
  render(<ol><StoreCard store={store} index={0} /></ol>);
  expect(screen.getByRole('link', { name: 'Call to confirm' })).toHaveAttribute('href', 'tel:+12035550101');
  expect(screen.getByRole('link', { name: 'Directions to Fixture' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=41,-72');
});

it('AC-17 a shop without online inventory shows call and directions but no price or stock', () => {
  const shop: OtherShop = { store_id: 9, name: 'Side B', area: 'Hoboken, NJ', distance_mi: 1.6,
    phone: '(201) 555-0142', lat: 40.744, lng: -74.0324 };
  const { container } = render(<ul><OtherShopCard shop={shop} /></ul>);
  expect(screen.getByRole('heading', { name: 'Side B' })).toBeVisible();
  expect(screen.getByText('1.6 mi · Hoboken, NJ')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Call to check' })).toHaveAttribute('href', 'tel:2015550142');
  expect(screen.getByRole('link', { name: 'Directions to Side B' })).toBeVisible();
  expect(container.textContent).not.toMatch(/\$|in stock/);
});

it('AC-17 with no phone there is no call link', () => {
  render(<ul><OtherShopCard shop={{ store_id: 9, name: 'No phone', area: null, distance_mi: 3,
    phone: null, lat: 41, lng: -72 }} /></ul>);
  expect(screen.queryByRole('link', { name: 'Call to check' })).toBeNull();
  expect(screen.getByText('No online inventory: stop by to check')).toBeVisible();
});
