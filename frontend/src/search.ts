import { ApiError } from './api';

export interface SearchAlbum {
  id: number; title: string; artist: { id: number; name: string }; year: number | null;
  format: string; cover_url: string | null; label: string | null; store_count: number;
  lowest_price: number | null; nearest_outside_mi: number | null; discogs_url: string;
}
export interface SearchResult {
  albums: SearchAlbum[]; artists: { id: number; name: string; image_url: string | null }[];
}
export async function fetchSearch(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<SearchResult> {
  const response = await fetch(`/api/${path}?${params}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body.detail === 'string' ? body.detail : 'Unable to search right now');
  }
  return response.json();
}
