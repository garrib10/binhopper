import { ApiError } from './api';

export interface SearchAlbum {
  id: number; title: string; artist: { id: number; name: string }; year: number | null;
  format: string; cover_url: string | null; label: string | null; store_count: number;
  lowest_price: number | null; nearest_outside_mi: number | null; discogs_url: string;
}
/** A genre or style named like the search; `genre` is the one it's filed under (itself for a genre). */
export interface GenreMatch { name: string; genre: string }
export interface SearchResult {
  albums: SearchAlbum[]; artists: { id: number; name: string; image_url: string | null }[]; genres?: GenreMatch[];
}
export interface Genre { name: string; albums: number; styles: string[] }
export async function fetchSearch(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<SearchResult> {
  const response = await fetch(`/api/${path}?${params}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body.detail === 'string' ? body.detail : 'Unable to search right now');
  }
  return response.json();
}

/** Every genre in the catalog with its common styles; null when the catalog can't be reached or is empty. */
export async function fetchGenres(signal?: AbortSignal): Promise<Genre[] | null> {
  const response = await fetch('/api/genres', { signal }).catch(() => null);
  if (!response?.ok) return null;
  const body = await response.json().catch(() => ({}));
  return Array.isArray(body.genres) && body.genres.length ? body.genres : null;
}

/** Where a genre or style's results live; `genre` and `style` bring "Change genre or year" back to it. */
export function browsePath(name: string, genre: string, extra?: URLSearchParams) {
  const params = new URLSearchParams(extra);
  params.set('genre', genre);
  if (name !== genre) params.set('style', name); else params.delete('style');
  return `/genres/${encodeURIComponent(name)}/years?${params}`;
}
