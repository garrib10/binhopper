import { ApiError } from './api';

export interface AlbumSummary {
  id: number; title: string; artist: { id: number; name: string }; year: number | null;
  cover_url: string | null; label: string | null; store_count: number; lowest_price: number | null;
  nearest_outside_mi: number | null; discogs_url: string;
}
export interface AlbumDetail extends AlbumSummary {
  genres: string[]; tracklist: { position: string; title: string }[]; release_type: string;
  pressings: { id: number; label: string | null; format: string; variant_note: string | null;
    exclusive_kind: 'artist' | 'retailer' | null; exclusive_to: string | null }[];
}
export async function getCatalog<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body.detail === 'string' ? body.detail : 'Unable to load this record');
  }
  return response.json();
}
export function stockLine(album: AlbumSummary, radius: number) {
  if (album.store_count) return `${album.store_count} ${album.store_count === 1 ? 'store' : 'stores'} within ${radius} mi${album.lowest_price !== null ? ` · from $${album.lowest_price.toFixed(2)}` : ''}`;
  return album.nearest_outside_mi !== null ? `Nearest copy is ${album.nearest_outside_mi} mi away` : 'Not in stock nearby';
}
