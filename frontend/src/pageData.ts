import { useEffect, useState } from 'react';

/** Data for the next page, fetched as soon as someone shows they're going there (hover, focus,
 *  the touch before a tap) or in the background, so the page draws complete the moment it
 *  opens instead of "Loading…" then a jump. In this tab's memory only; cleared on sign-out. */
const entries = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** Start loading `key` unless it's already on its way; the page reuses the same request. */
export function prefetch<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const request = load().then((data) => { entries.set(key, data); return data; })
    .finally(() => inflight.delete(key));
  request.catch(() => {});  // a failed prefetch is retried by the page itself
  inflight.set(key, request);
  return request;
}

export function peek<T>(key: string): T | undefined {
  return entries.get(key) as T | undefined;
}

/** Data another page already has (the album page's album for "Add to collection"). */
export function share(key: string, data: unknown) {
  entries.set(key, data);
}

/** Changed or signed out: drop entries whose key starts with `prefix` (all of them by default). */
export function forgetPageData(prefix = '') {
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
}

/** Props for a link: start loading its page on hover, keyboard focus or touch. */
export function loadsOnIntent(key: string, load: () => Promise<unknown>) {
  const start = () => { void prefetch(key, load); };
  return { onPointerEnter: start, onFocus: start, onTouchStart: start };
}

/** A page's data: what's already here draws at once, then a fresh copy replaces it quietly.
 *  `error` is only set when there's nothing to show. */
export function usePageData<T>(key: string, load: () => Promise<T>, attempt = 0) {
  const [data, setData] = useState<T | undefined>(() => peek<T>(key));
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    setData(peek<T>(key));
    setError(null);
    prefetch(key, load).then((fresh) => { if (active) setData(fresh); })
      .catch((err) => { if (active && peek(key) === undefined) setError(err); });
    return () => { active = false; };
    // `load` is rebuilt every render; `key` names what it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return { data, error };
}
