// Response types come from the API's own models (src/api-types.ts, generated from
// backend/openapi.json; CI fails if they drift, #68).
import type { NearbyStockResponse } from './api-types';
export type { Freshness, NearbyStockResponse, NearbyStore, OtherShop } from './api-types';

export const RADII = [10, 25, 50, 100] as const;
export type Radius = (typeof RADII)[number];

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchNearbyStock(
  albumId: number,
  zip: string,
  radius: Radius,
  signal?: AbortSignal,
): Promise<NearbyStockResponse> {
  const params = new URLSearchParams({ zip, radius: String(radius) });
  const res = await fetch(`/api/albums/${albumId}/stock?${params}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorDetail(body) ?? 'Something went wrong');
  }
  return res.json();
}

/** FastAPI sends `detail` as a string, or for validation errors (422) as a list of `{ msg }`. */
export function errorDetail(body: { detail?: unknown }): string | null {
  const { detail } = body;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
  return null;
}
