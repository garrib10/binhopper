export type Freshness = 'verified' | 'current' | 'out_of_date' | 'reported_missing';

export interface NearbyStore {
  listing_id: number;
  store_id: number;
  store_name: string;
  area: string | null;
  distance_mi: number;
  pressing_id: number;
  pressing_note: string | null;
  price: number;
  condition: string;
  quantity: number;
  freshness: Freshness;
  last_updated_at: string | null;
  lat?: number;
  lng?: number;
  phone?: string | null;
  source?: string;
  discogs_url?: string | null;
}

/** A shop in the radius with no online inventory: call to check (never a price). */
export interface OtherShop {
  store_id: number;
  name: string;
  area: string | null;
  distance_mi: number;
  phone: string | null;
  lat: number;
  lng: number;
}

export interface NearbyStockResponse {
  album_id: number;
  zip: string;
  radius_mi: number;
  center_lat?: number;
  center_lng?: number;
  stores: NearbyStore[];
  nearest_outside_mi: number | null;
  other_shops?: OtherShop[];
}

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
