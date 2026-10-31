import { ApiError, errorDetail, type Freshness } from './api';
import { CSRF_HEADER } from './auth';
import { AlreadyOwned, changed, type Copy, type WishlistEffect } from './collection';

export interface HandoffListing {
  listing_id: number;
  album: { id: number; title: string; year: number | null; artist: string; cover_url: string | null };
  pressing: { id: number; note: string | null; label: string | null; format: string };
  store: { id: number; name: string; area: string | null; address: string | null; phone: string | null;
    website: string | null; lat: number; lng: number };
  price: number;
  condition: string;
  quantity: number;
  freshness: Freshness;
  discogs_url: string | null;
}

export async function fetchListing(id: number, signal?: AbortSignal): Promise<HandoffListing> {
  const response = await fetch(`/api/listings/${id}`, { signal });
  if (!response.ok) throw new ApiError(response.status, errorDetail(await response.json().catch(() => ({}))) ?? 'Unable to load this record');
  return response.json();
}

/** "Got it? Add to collection" (AC-10): adds the copy and takes the album off the wishlist. */
export async function gotIt(listingId: number, anotherCopy = false): Promise<Copy & WishlistEffect> {
  const response = await fetch('/api/me/collection/from-listing', {
    method: 'POST', credentials: 'same-origin', headers: { ...CSRF_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify({ listing_id: listingId, another_copy: anotherCopy }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 409) throw new AlreadyOwned(body.detail?.copies ?? 1);
  if (!response.ok) throw new ApiError(response.status, errorDetail(body) ?? 'Something went wrong. Try again.');
  return changed(body);
}

/** A hand-off the user hasn't answered "Got it?" for yet. Kept in this browser only. */
export interface Handoff { listingId: number; albumId: number; albumTitle: string; storeName: string; at: number }

const KEY = 'binhopper.handoffs';
export const ASK_FOR_MS = 7 * 24 * 3_600_000;  // "Got it?" is offered for up to 7 days

function read(): Handoff[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function write(list: Handoff[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* optional, like the saved location */ }
}

export function pendingHandoffs(now = Date.now()): Handoff[] {
  const fresh = read().filter((h) => now - h.at < ASK_FOR_MS);
  write(fresh);
  return fresh;
}

export function recordHandoff(handoff: Omit<Handoff, 'at'>, now = Date.now()) {
  write([{ ...handoff, at: now }, ...pendingHandoffs(now).filter((h) => h.listingId !== handoff.listingId)]);
}

/** Answered ("got it" or "no thanks"): stop asking. */
export function forgetHandoff(listingId: number) {
  write(read().filter((h) => h.listingId !== listingId));
}
