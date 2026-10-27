// Vercel Routing Middleware: serves /api from the same origin as the app so
// browsers treat API cookies as first-party. Registered in vercel.json
// ("proxy", matcher /api/:path*); static files and SPA routes never invoke it.
//
// rewrite() makes Vercel's CDN act as a reverse proxy: it forwards the
// original method, body and headers (including Cookie), adds x-forwarded-for /
// -proto / -host, and returns the API's status, headers (including every
// Set-Cookie) and body unchanged. This file picks the destination and, when
// ORIGIN_SECRET is set, adds the x-origin-secret header so the API can reject
// requests that bypass Vercel (#122).
import { rewrite } from '@vercel/functions';

export const NOT_CONFIGURED = { detail: 'API not configured' };
export const ORIGIN_SECRET_HEADER = 'x-origin-secret';

/** The configured API origin (scheme + host, no path), or null if unset or invalid. */
export function apiOrigin(value = process.env.API_ORIGIN): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return new URL(url.origin);
  } catch {
    return null;
  }
}

export default function proxy(request: Request): Response {
  const origin = apiOrigin();
  if (!origin) {
    console.error('API_ORIGIN is missing or not an http(s) URL; /api requests return 503');
    // The app's fetch helpers read `detail` and show "Can't reach Binhopper".
    return Response.json(NOT_CONFIGURED, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const { pathname, search } = new URL(request.url);
  const destination = new URL(pathname + search, origin);
  const secret = process.env.ORIGIN_SECRET?.trim();
  if (!secret) return rewrite(destination);
  // Overriding request headers replaces the whole set, so pass every original header
  // (Cookie, Content-Type, X-Forwarded-*...) plus the secret. `set` overwrites any
  // client-supplied value. Host is left out: Railway routes on its own host name.
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set(ORIGIN_SECRET_HEADER, secret);
  return rewrite(destination, { request: { headers } });
}
