import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppShell } from '../App';

const album = { id: 1, title: 'Rumours', artist: { id: 1, name: 'Fleetwood Mac' }, year: 1977,
  format: 'LP', cover_url: null, label: 'Warner Bros.', store_count: 3, lowest_price: 26, nearest_outside_mi: null,
  discogs_url: 'https://www.discogs.com/master/1' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });
function setup(path = '/search') {
  vi.useFakeTimers();
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ albums: [album], artists: [] })));
  render(<MemoryRouter initialEntries={[path]}><AppShell /></MemoryRouter>);
  return fetch;
}
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

it('AC-12 sends nothing below 2 characters and debounces until typing pauses', async () => {
  const fetch = setup();
  fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'R' } });
  await advance(500);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'Ru' } });
  await advance(299);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'Rum' } });
  await advance(300);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain('q=Rum');
  expect(screen.getByText('Rumours')).toBeVisible();
});

it('preserves filters when query changes and serializes saved location', async () => {
  localStorage.setItem('binhopper.location', JSON.stringify({ zip: '06010', radius: 50 }));
  const fetch = setup('/search?q=Ru&new=true');
  fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'Rumours' } });
  await advance(300);
  const request = new URL(String(fetch.mock.calls[0][0]), 'http://test');
  expect(request.searchParams.get('new')).toBe('true');
  expect(request.searchParams.get('zip')).toBe('06010');
  expect(request.searchParams.get('radius')).toBe('50');
});

it('allows genre, decade and optional year browsing', async () => {
  const fetch = setup('/genres');
  fireEvent.click(screen.getByRole('button', { name: /^Rock$/ }));
  await advance(0);
  fireEvent.click(screen.getByRole('button', { name: '1970s' }));
  await advance(0);
  fireEvent.click(screen.getByRole('button', { name: '1977' }));
  await advance(0);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link', { name: 'Show Rock from 1977' }));
  await advance(0);
  const request = new URL(String(fetch.mock.calls.at(-1)![0]), 'http://test');
  expect(request.pathname).toBe('/api/browse');
  expect(request.searchParams.get('genre')).toBe('Rock');
  expect(request.searchParams.get('decade')).toBe('1970');
  expect(request.searchParams.get('year')).toBe('1977');
});

it('shows the notice the Discogs API terms require on every screen', () => {
  setup();
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    'This application uses Discogs’ API but is not affiliated with, sponsored or endorsed by Discogs. ‘Discogs’ is a trademark of Zink Media, LLC.');
});

it('keeps "Search" highlighted in the header while browsing by genre and year', () => {
  setup('/genres');
  expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
});
