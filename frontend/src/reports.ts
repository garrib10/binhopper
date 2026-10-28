import { ApiError, errorDetail, type Freshness } from './api';
import { sendJson } from './auth';

export type ReportResult = 'present' | 'missing' | 'different_price';

export interface ReportableListing {
  listing_id: number;
  store: { id: number; name: string };
  album: { id: number; title: string };
  pressing_note: string;
  price: number;
  condition: string;
  quantity: number;
  source: string;
  freshness: Freshness;
  last_updated_at: string | null;
  reported_today: boolean;
}

export interface SightingForm {
  store: { id: number; name: string; area: string | null };
  album: { id: number; title: string; artist: string };
  pressings: { id: number; note: string; detail: string }[];
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorDetail(body) ?? 'Something went wrong');
  }
  return response.json();
}

export const fetchListing = (id: number, signal?: AbortSignal) => getJson<ReportableListing>(`/stock/${id}`, signal);
export const reportListing = (id: number, result: ReportResult, reportedPrice: number | null) =>
  sendJson<{ listing_id: number }>('POST', `/stock/${id}/reports`, { result, reported_price: reportedPrice });
export const fetchSightingForm = (storeId: number, albumId: number, signal?: AbortSignal) =>
  getJson<SightingForm>(`/stores/${storeId}/sighting?album_id=${albumId}`, signal);
export const reportSighting = (storeId: number, body: { album_id: number; pressing_id: number; condition: 'New' | 'Used'; price: number }) =>
  sendJson<{ listing_id: number }>('POST', `/stores/${storeId}/sightings`, body);

/** "synced 6 hr ago" / "2 days ago" for the report screen's listing line. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'not updated yet';
  const hours = Math.max(0, Math.round((now - new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime()) / 3_600_000));
  if (hours < 1) return 'updated just now';
  if (hours < 48) return `updated ${hours} hr ago`;
  return `updated ${Math.round(hours / 24)} days ago`;
}

/** Turn a price field ("$29", "29.50") into a number, or null if it isn't one. */
export function parsePrice(value: string): number | null {
  const price = Number(value.trim().replace(/^\$/, ''));
  return value.trim() !== '' && price > 0 ? price : null;
}
