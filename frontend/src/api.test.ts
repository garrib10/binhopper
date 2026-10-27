import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNearbyStock } from './api';
import { getCatalog } from './catalog';
import { fetchSearch } from './search';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ stores: [], albums: [], artists: [] }), { status: 200 }),
  );
}

describe('API hosting', () => {
  // Vite proxies /api locally; Vercel Routing Middleware proxies it when deployed.
  it('calls same-origin /api even if an old VITE_API_BASE_URL is still set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const fetch = mockFetch();
    const { signal } = new AbortController();

    await fetchNearbyStock(42, '10011', 25, signal);
    await fetchSearch('search', new URLSearchParams({ q: 'blue' }), signal);
    await getCatalog('/albums/7', signal);

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/albums/42/stock?zip=10011&radius=25',
      '/api/search?q=blue',
      '/api/albums/7',
    ]);
    expect(fetch).toHaveBeenCalledWith('/api/albums/42/stock?zip=10011&radius=25', { signal });
  });
});
