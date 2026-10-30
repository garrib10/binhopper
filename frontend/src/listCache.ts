import { useCallback, useEffect, useRef, useState } from 'react';

/** The last copy of each list this tab loaded, per account, in memory only (never in browser
 *  storage). Coming back to Wishlist or Collection shows it at once while a fresh copy loads. */
const lists = new Map<string, unknown>();

/** Signing out, or deleting the account, drops every remembered list. */
export function forgetLists() { lists.clear(); }

export type ListState<T> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; data: T; refreshing: boolean };

/** Loads a list, showing the remembered copy first. `name` must change whenever `load` would
 *  fetch something different (sort, location), since it keys both the cache and the reload. */
export function useCachedList<T>(owner: number | null, name: string, load: (signal: AbortSignal) => Promise<T>) {
  const key = owner === null ? null : `${owner}:${name}`;  // no account known yet: nothing is remembered
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
    setState(cached === undefined ? { kind: 'loading' } : { kind: 'loaded', data: cached, refreshing: true });
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
