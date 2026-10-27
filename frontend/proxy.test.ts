// @vitest-environment node
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import proxy, { apiOrigin, NOT_CONFIGURED } from './proxy';

// A stand-in for the Railway API that records what reached it.
let api: Server;
let apiUrl: string;
let received: { method?: string; url?: string; cookie?: string; body: string; forwardedFor?: string }[] = [];

beforeAll(async () => {
  api = createServer(async (req: IncomingMessage, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received.push({
      method: req.method, url: req.url, cookie: req.headers.cookie, body,
      forwardedFor: req.headers['x-forwarded-for'] as string | undefined,
    });
    res.statusCode = req.url?.startsWith('/api/missing') ? 404 : 201;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Api', 'railway');
    res.setHeader('Set-Cookie', ['session=abc; Path=/; HttpOnly; Secure; SameSite=Lax', 'csrf=xyz; Path=/; Secure']);
    res.end(JSON.stringify({ detail: 'from api' }));
  });
  await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => api.close(() => resolve())));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  received = [];
});

/**
 * Plays Vercel's part after the middleware runs, as documented for rewrite():
 * an x-middleware-rewrite response sends the ORIGINAL request (method, body,
 * headers) to that URL and returns the upstream response unchanged. Any other
 * response from the middleware goes straight to the browser.
 */
async function viaVercel(request: Request): Promise<Response> {
  const decision = proxy(request.clone());
  const destination = decision.headers.get('x-middleware-rewrite');
  if (!destination) return decision;
  // The proxy must not replace request headers, or Vercel would drop Cookie etc.
  expect(decision.headers.get('x-middleware-override-headers')).toBeNull();
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  return fetch(destination, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });
}

describe('Vercel /api proxy', () => {
  it('rewrites to API_ORIGIN keeping the /api path and the query string', () => {
    vi.stubEnv('API_ORIGIN', 'https://binhopper-staging.up.railway.app/');
    const response = proxy(new Request('https://app.vercel.app/api/search?q=blue%20note&format=LP&format=CD'));
    expect(response.headers.get('x-middleware-rewrite'))
      .toBe('https://binhopper-staging.up.railway.app/api/search?q=blue%20note&format=LP&format=CD');
  });

  it('uses only the origin of API_ORIGIN, so a stray /api suffix is not doubled', () => {
    expect(apiOrigin('https://api.example.test/api/')?.href).toBe('https://api.example.test/');
    expect(apiOrigin(' http://127.0.0.1:8000 ')?.href).toBe('http://127.0.0.1:8000/');
  });

  it('forwards method, body and Cookie, and returns status, headers and every Set-Cookie unchanged', async () => {
    vi.stubEnv('API_ORIGIN', apiUrl);
    const response = await viaVercel(new Request('https://app.vercel.app/api/me/wishlist?sort=new', {
      method: 'POST',
      headers: { Cookie: 'session=old', 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7' },
      body: JSON.stringify({ album_id: 7 }),
    }));

    expect(received).toEqual([{
      method: 'POST', url: '/api/me/wishlist?sort=new', cookie: 'session=old',
      body: '{"album_id":7}', forwardedFor: '203.0.113.7',
    }]);
    expect(response.status).toBe(201);
    expect(response.headers.get('x-api')).toBe('railway');
    expect(response.headers.getSetCookie()).toEqual([
      'session=abc; Path=/; HttpOnly; Secure; SameSite=Lax',
      'csrf=xyz; Path=/; Secure',
    ]);
    expect(await response.json()).toEqual({ detail: 'from api' });
  });

  it('passes API error statuses through instead of replacing them', async () => {
    vi.stubEnv('API_ORIGIN', apiUrl);
    const response = await viaVercel(new Request('https://app.vercel.app/api/missing', { method: 'DELETE' }));
    expect(received[0].method).toBe('DELETE');
    expect(response.status).toBe(404);
  });

  it.each([undefined, '', '   ', 'railway.example', 'ftp://api.example.test'])(
    'returns a 503 JSON error when API_ORIGIN is %j',
    async (value) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      if (value === undefined) vi.stubEnv('API_ORIGIN', undefined as unknown as string);
      else vi.stubEnv('API_ORIGIN', value);
      const response = await viaVercel(new Request('https://app.vercel.app/api/health'));
      expect(response.status).toBe(503);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual(NOT_CONFIGURED);
      expect(received).toEqual([]);
    },
  );
});

describe('vercel.json routing', () => {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
  const spa = new RegExp(`^${config.rewrites[0].source}$`);

  it('runs the proxy only for /api paths, never for static files or app routes', () => {
    expect(config.proxy).toEqual({ entrypoint: 'proxy.ts', matcher: ['/api/:path*'] });
  });

  it('keeps the SPA fallback for app routes but never serves index.html for /api', () => {
    for (const path of ['/', '/albums/7', '/search', '/apiary']) expect(spa.test(path)).toBe(true);
    for (const path of ['/api/health', '/api/albums/7/stock']) expect(spa.test(path)).toBe(false);
    expect(config.rewrites[0].destination).toBe('/index.html');
  });

  it('turns off CDN caching of proxied API responses', () => {
    expect(config.headers).toContainEqual({
      source: '/api/:path*',
      headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '0' }],
    });
  });
});
