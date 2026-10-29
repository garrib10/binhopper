import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMe, register, safeReturnTo, signOut, takeLinkToken } from './auth';

afterEach(() => { window.history.replaceState(null, '', '/'); });

describe('auth requests', () => {
  it('sends the CSRF header on every POST (#38)', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ detail: 'Check your email' }), { status: 202 }));
    await register('a@example.com', 'long-enough-1');
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST', credentials: 'same-origin',
      headers: { 'X-Binhopper-CSRF': '1', 'Content-Type': 'application/json' },
    }));
    fetch.mockImplementation(async () => new Response(null, { status: 204 }));
    await signOut();
    expect(fetch.mock.calls[1][1]?.headers).toEqual({ 'X-Binhopper-CSRF': '1' });
  });

  it('treats 401 from /me as signed out', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 401 }));
    expect(await getMe()).toBeNull();
  });

  it('shows the rate-limit message from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ detail: 'Too many attempts. Try again in 15 minutes.' }), { status: 429 }));
    await expect(register('a@example.com', 'long-enough-1')).rejects.toMatchObject({
      status: 429, message: 'Too many attempts. Try again in 15 minutes.' });
  });
});

describe('links', () => {
  it.each(['https://evil.example.com', '//evil.example.com', '/\\evil.example.com', null])(
    'never returns somewhere off the site: %s', (value) => {
      expect(safeReturnTo(value)).toBe('/search');
    });

  it('keeps paths on the site', () => {
    expect(safeReturnTo('/wishlist?sort=new')).toBe('/wishlist?sort=new');
  });

  it('reads the emailed token from the fragment and removes it from the address bar', () => {
    window.history.replaceState(null, '', '/verify#token=abc-123');
    expect(takeLinkToken()).toBe('abc-123');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/verify');
  });
});
