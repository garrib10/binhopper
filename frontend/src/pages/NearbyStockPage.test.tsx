import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NearbyStockResponse } from '../api';
import { NearbyStockPage } from './NearbyStockPage';

vi.mock('../catalog', () => ({ getCatalog: vi.fn().mockResolvedValue({ album_title: 'Rumours', artist_name: 'Fleetwood Mac', sellers: [] }) }));

function mockApi(body: Partial<NearbyStockResponse>) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ album_id: 1, zip: '10011', radius_mi: 25, stores: [], nearest_outside_mi: null, ...body }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
}

function mockError(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const page = <NearbyStockPage albumId={1} albumTitle="Rumours" artistName="Fleetwood Mac" />;

describe('NearbyStockPage', () => {
  it('lists stores in the order the API returns', async () => {
    mockApi({
      stores: [
        { listing_id: 1, store_id: 1, store_name: 'Spin Cycle Records', area: 'Chelsea', distance_mi: 3.2,
          pressing_id: 1, pressing_note: '180g reissue', price: 26, condition: 'New', quantity: 2,
          freshness: 'current', last_updated_at: null },
        { listing_id: 2, store_id: 2, store_name: 'Groove Merchant', area: null, distance_mi: 21.4,
          pressing_id: 1, pressing_note: null, price: 28, condition: 'New', quantity: 3,
          freshness: 'out_of_date', last_updated_at: null },
      ],
    });
    render(page);
    expect(await screen.findByRole('heading', { name: '2 stores have it' })).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Spin Cycle Records', 'Groove Merchant']);
    expect(screen.getByText('May be out of date: call to confirm')).toBeInTheDocument();
  });

  it('shows the empty state with the nearest copy and a wider radius', async () => {  // AC-03
    mockApi({ stores: [], nearest_outside_mi: 38 });
    render(page);
    expect(await screen.findByRole('heading', { name: 'Nothing within 25 mi' })).toBeInTheDocument();
    expect(screen.getByText('Nearest copy is 38 mi away.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try 50 mi' })).toBeInTheDocument();
  });

  it('rejects an invalid ZIP without calling the API again', async () => {  // AC-04
    const fetchSpy = mockApi({});
    render(page);
    await screen.findByRole('heading', { name: 'Nothing within 25 mi' });
    const callsBefore = fetchSpy.mock.calls.length;

    const input = screen.getByLabelText('ZIP code');
    await userEvent.clear(input);
    await userEvent.type(input, '1001{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a 5-digit ZIP code');
    expect(fetchSpy.mock.calls.length).toBe(callsBefore);
  });

  describe('errors', () => {
    it('explains an unknown ZIP', async () => {  // AC-04
      mockError(404, { detail: 'Unknown ZIP code' });
      render(page);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        "We don't have that ZIP yet. Check it or try a nearby one.",
      );
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    });

    it('shows the first validation message from a 422', async () => {
      mockError(422, {
        detail: [
          { type: 'string_pattern_mismatch', loc: ['query', 'zip'], msg: "String should match pattern '^\\d{5}$'" },
          { type: 'missing', loc: ['query', 'radius'], msg: 'Field required' },
        ],
      });
      render(page);
      expect(await screen.findByRole('alert')).toHaveTextContent("String should match pattern '^\\d{5}$'");
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('offers Try again when the network fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
      render(page);
      expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach Binhopper right now.");
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('offers Try again on a server error', async () => {
      mockError(500, { detail: 'Internal Server Error' });
      render(page);
      expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach Binhopper right now.");
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('Try again fetches the stores again', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ album_id: 1, zip: '10011', radius_mi: 25, stores: [], nearest_outside_mi: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      render(page);
      await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      expect(await screen.findByRole('heading', { name: 'Nothing within 25 mi' })).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
