import { useCallback, useEffect, useRef, useState } from 'react';

/** The last copy of each list this tab loaded, per account, in memory only (never in browser
 *  storage). Coming back to Wishlist or Collection shows it at once while a fresh copy loads. */
const lists = new Map<string, unknown>();

/** Signing out, or deleting the account, drops every remembered list. */
export function forgetLists() { lists.clear(); }

/** A change made elsewhere drops the remembered copies of those lists (names start with `kind:`),
 *  so the next visit loads them fresh instead of flashing what was there before. */
export function dropLists(kind: 'wishlist' | 'collection') {
  for (const key of [...lists.keys()]) if (key.split(':')[1] === kind) lists.delete(key);
}

/** An album left the wishlist: take it out of every remembered wishlist now, keeping it instant. */
export function dropFromWishlists(albumId: number) {
  for (const [key, items] of lists) {
    if (key.split(':')[1] === 'wishlist' && Array.isArray(items)) {
      lists.set(key, items.filter((item: { album?: { id?: number } }) => item.album?.id !== albumId));
    }
  }
  dropLists('collection');  // its stats count the wishlist
}

export type ListState<T> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; data: T; refreshing: boolean };

/** Loads a list, showing the remembered copy first. `name` must change whenever `load` would
 *  fetch something different (sort, location), since it keys both the cache and the reload. */
export function useCachedList<T>(owner: number | null, name: string, load: (signal: AbortSignal) => Promise<T>) {
  const key = owner === null ? null : `${owner}:${name}`;  // no account known yet: nothing is remembered
  const shownFor = useRef(owner);  // whose list is on screen now
  const loader = useRef(load);
  loader.current = load;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ListState<T>>(() => {
    const cached = key === null ? undefined : lists.get(key) as T | undefined;
    return cached === undefined ? { kind: 'loading' } : { kind: 'loaded', data: cached, refreshing: true };
  });
  useEffect(() => {
    const controller = new AbortController();
    const cached = key === null ? undefined : lists.get(key) as T | undefined;
    const sameOwner = shownFor.current === owner;
    shownFor.current = owner;
    // Remembered: show it. Not yet (a sort or location not opened before): keep this account's
    // current list on screen while the new one loads, so the page doesn't jump to placeholders.
    setState((prev) => cached !== undefined ? { kind: 'loaded', data: cached, refreshing: true }
      : prev.kind === 'loaded' && sameOwner ? { ...prev, refreshing: true } : { kind: 'loading' });
    loader.current(controller.signal)
      .then((data) => { if (!controller.signal.aborted) { if (key !== null) lists.set(key, data); setState({ kind: 'loaded', data, refreshing: false }); } })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'error' }); });
    return () => controller.abort();
  }, [key, name, attempt]);
  /** Show a local change at once (a removal, an edit) and remember it; call reload() to confirm. */
  const update = useCallback((change: (data: T) => T) => setState((current) => {
    if (current.kind !== 'loaded') return current;
    const data = change(current.data);
    if (key !== null) lists.set(key, data);
    return { ...current, data };
  }), [key]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, update, reload };
}
