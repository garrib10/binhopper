import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { StoreCard } from './StoreCard';
import type { NearbyStore } from '../api';

it('AC-05 stale shop has a callable phone and directions without an origin location', () => {
  const store: NearbyStore = { listing_id: 1, store_id: 1, store_name: 'Fixture', area: 'Town',
    distance_mi: 4, pressing_id: 1, pressing_note: null, price: 20, condition: 'VG+', quantity: 1,
    freshness: 'out_of_date', last_updated_at: null, lat: 41, lng: -72, phone: '+1 (203) 555-0101' };
  render(<ol><StoreCard store={store} index={0} /></ol>);
  expect(screen.getByRole('link', { name: 'Call to confirm' })).toHaveAttribute('href', 'tel:+12035550101');
  expect(screen.getByRole('link', { name: 'Directions to Fixture' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=41,-72');
});
