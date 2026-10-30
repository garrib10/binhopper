import { ApiError, errorDetail } from './api';
import { CSRF_HEADER, sendJson } from './auth';
import type { Grade } from './grades';

export interface CopyDetails {
  media_grade: Grade | null;
  sleeve_grade: Grade | null;
  price_paid: number | null;
  bought_at: string | null;
  notes: string | null;
}

export interface Copy extends CopyDetails {
  id: number;
  album: { id: number; title: string; year: number | null; cover_url: string | null; artist: { id: number; name: string } };
  pressing: { id: number; note: string; label: string | null; format: string };
  copy_number: number;
  added_at: string;
  genre?: string | null;
}

export interface CopyDetail extends Copy { pressings: { id: number; note: string; detail: string }[] }

export type CollectionSort = 'recent' | 'artist' | 'genre' | 'year';
export interface CollectionResponse {
  items: Copy[];
  stats: { records: number; artists: number; duplicates: number; wishlist: number };
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorDetail(body) ?? 'Unable to load your collection');
  }
  return response.json();
}

export const fetchCollection = (sort: CollectionSort, signal?: AbortSignal) =>
  getJson<CollectionResponse>(`/me/collection?sort=${sort}`, signal);
export const fetchCopy = (id: number, signal?: AbortSignal) => getJson<CopyDetail>(`/me/collection/${id}`, signal);
export const fetchOwned = (albumId: number, signal?: AbortSignal) =>
  getJson<{ copies: Record<string, number> }>(`/me/collection/owned?album_id=${albumId}`, signal);
export const updateCopy = (id: number, pressingId: number, details: CopyDetails) =>
  sendJson<Copy>('PATCH', `/me/collection/${id}`, { pressing_id: pressingId, ...details });
export const removeCopy = (id: number) => sendJson<void>('DELETE', `/me/collection/${id}`);

/** What adding a copy did to the wishlist (SPEC › Collection rule 6). */
export interface WishlistEffect { removed_from_wishlist: boolean; album_on_wishlist: boolean }

/** Thrown when the pressing is already owned: the app offers "Add as 2nd copy" (rule 3, AC-09). */
export class AlreadyOwned extends Error {
  constructor(public copies: number) { super('You already own this pressing'); }
}

export async function addCopy(pressingId: number, details: CopyDetails, anotherCopy = false): Promise<Copy & WishlistEffect> {
  const response = await fetch('/api/me/collection', {
    method: 'POST', credentials: 'same-origin',
    headers: { ...CSRF_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pressing_id: pressingId, ...details, another_copy: anotherCopy }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 409) throw new AlreadyOwned(body.detail?.copies ?? 1);
  if (!response.ok) throw new ApiError(response.status, errorDetail(body) ?? 'Something went wrong. Try again.');
  return body;
}

/** 2nd, 3rd, 4th… */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export const gradePair = (copy: CopyDetails) =>
  copy.media_grade || copy.sleeve_grade ? `${copy.media_grade ?? '–'} / ${copy.sleeve_grade ?? '–'}` : null;
