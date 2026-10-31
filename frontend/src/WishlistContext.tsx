import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { dropFromWishlists, dropLists } from './listCache';
import { addToWishlist, fetchWishlistedAlbums, removeAlbumFromWishlist } from './wishlist';

interface WishlistValue {
  has: (albumId: number) => boolean;
  /** Add or remove the album; saved right away (SPEC › Wishlist rule 1). Rejects if saving failed. */
  toggle: (albumId: number) => Promise<void>;
  forget: (albumId: number) => void;
}

const WishlistContext = createContext<WishlistValue>({ has: () => false, toggle: async () => {}, forget: () => {} });

/** Which albums the signed-in user has hearted, shared by every heart on screen. */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());
  // Taps made while the saved hearts are still loading; the loaded list must not undo them.
  const tapsWhileLoading = useRef<Map<number, boolean> | null>(null);
  const accountId = state.status === 'signed-in' ? state.account.id : null;
  useEffect(() => {
    setIds(new Set());
    if (accountId === null) return;
    let active = true;
    tapsWhileLoading.current = new Map();
    fetchWishlistedAlbums().then((r) => {
      if (!active) return;
      const next = new Set(r.album_ids);
      for (const [id, on] of tapsWhileLoading.current ?? []) { if (on) next.add(id); else next.delete(id); }
      setIds(next);
    }).catch(() => {}).finally(() => { if (active) tapsWhileLoading.current = null; });
    return () => { active = false; };
  }, [accountId]);

  const toggle = useCallback(async (albumId: number) => {
    const on = ids.has(albumId);
    const flip = (value: boolean) => setIds((current) => {
      tapsWhileLoading.current?.set(albumId, value);
      const next = new Set(current);
      if (value) next.add(albumId); else next.delete(albumId);
      return next;
    });
    flip(!on); // optimistic; undone if the save fails
    try {
      if (on) await removeAlbumFromWishlist(albumId); else await addToWishlist(albumId);
      // Remembered Wishlist/Collection lists must not flash the old state on the next visit.
      if (on) dropFromWishlists(albumId); else { dropLists('wishlist'); dropLists('collection'); }
    } catch (error) {
      flip(on);
      throw error;
    }
  }, [ids]);
  const forget = useCallback((albumId: number) => {
    dropFromWishlists(albumId);
    setIds((current) => { const next = new Set(current); next.delete(albumId); return next; });
  }, []);
  const value = useMemo(() => ({ has: (id: number) => ids.has(id), toggle, forget }), [ids, toggle, forget]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistValue {
  return useContext(WishlistContext);
}
