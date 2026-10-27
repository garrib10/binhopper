import { render, screen } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { StockMap } from './StockMap';

const data = { album_id: 1, zip: '06037', radius_mi: 25, center_lat: 41.6, center_lng: -72.8,
  stores: [], nearest_outside_mi: 38 };
afterEach(() => vi.unstubAllEnvs());
it('AC-03 production has no implicit public OSM tile requests and preserves the ZIP caption', () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_MAP_TILE_URL', ''); vi.stubEnv('VITE_MAP_ATTRIBUTION', '');
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  render(<StockMap data={data} />);
  expect(screen.getByText('Map unavailable. Use the shop list below.')).toBeInTheDocument();
  expect(screen.getByText(/Centered on ZIP 06037/)).toBeInTheDocument();
  expect(fetchSpy).not.toHaveBeenCalled();
});
