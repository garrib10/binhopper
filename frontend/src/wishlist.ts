import { ApiError } from './api';
import { sendJson } from './auth';

import type { Grade } from './grades';

export { GRADES, type Grade } from './grades';

interface ShopPrice { store_name: string; distance_mi: number; price: number }

export interface WishlistItem {
  id: number;
  album: { id: number; title: string; year: number | null; cover_url: string | null; artist: { id: number; name: string } };
  pressing_id: number | null;
  pressing_note: string | null;
  max_price: number | null;
  min_condition: Grade | null;
  pressings: { id: number; note: string | null }[];
  store_count: number;
  nearest: ShopPrice | null;
  cheapest: ShopPrice | null;
  nearest_outside_mi: number | null;
}

export interface WishlistTarget { pressing_id: number | null; max_price: number | null; min_condition: Grade | null }

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body.detail === 'string' ? body.detail : 'Unable to load your wishlist');
  }
  return response.json();
}

export const fetchWishlist = (zip: string, radius: number, signal?: AbortSignal) =>
  getJson<{ items: WishlistItem[] }>(`/me/wishlist?${new URLSearchParams({ zip, radius: String(radius) })}`, signal);
export const fetchWishlistedAlbums = () => getJson<{ album_ids: number[] }>('/me/wishlist/albums');
export const addToWishlist = (albumId: number) => sendJson<{ id: number }>('POST', '/me/wishlist', { album_id: albumId });
export const removeAlbumFromWishlist = (albumId: number) => sendJson<void>('DELETE', `/me/wishlist?album_id=${albumId}`);
export const updateWishlistItem = (id: number, target: WishlistTarget) => sendJson<{ id: number }>('PATCH', `/me/wishlist/${id}`, target);
export const removeWishlistItem = (id: number) => sendJson<void>('DELETE', `/me/wishlist/${id}`);

/** "Any pressing · VG+ or better · under $35" (the mockup's "Wants:" line). */
export function wantText(item: Pick<WishlistItem, 'pressing_note' | 'min_condition' | 'max_price'>): string {
  return [item.pressing_note ?? 'Any pressing', item.min_condition && `${item.min_condition} or better`,
    item.max_price !== null && `under $${item.max_price % 1 ? item.max_price.toFixed(2) : item.max_price}`]
    .filter(Boolean).join(' · ');
}
