import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNearbyStock } from './api';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('API hosting', () => {
  it.each([
    ['', '/api/albums/42/stock?zip=10011&radius=25'],
    ['https://api.example.test', 'https://api.example.test/api/albums/42/stock?zip=10011&radius=25'],
    ['https://api.example.test/', 'https://api.example.test/api/albums/42/stock?zip=10011&radius=25'],
  ])('uses the configured API origin %s', async (base, expected) => {
    vi.stubEnv('VITE_API_BASE_URL', base);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ stores: [] }), { status: 200 }),
    );
    const controller = new AbortController();
    await fetchNearbyStock(42, '10011', 25, controller.signal);
    expect(fetch).toHaveBeenCalledWith(expected, { signal: controller.signal });
  });
});
