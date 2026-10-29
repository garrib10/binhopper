// Generated from backend/openapi.json by backend/scripts/export_openapi.py (#68).
// Do not edit: change the Pydantic models, then run `python -m scripts.export_openapi`.

export interface CopyChange {
  media_grade?: string | null;
  sleeve_grade?: string | null;
  price_paid?: number | null;
  bought_at?: string | null;
  notes?: string | null;
  pressing_id: number;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface EmailBody {
  email: string;
}

export type Freshness = "verified" | "current" | "out_of_date" | "reported_missing";

export interface GotIt {
  listing_id: number;
  another_copy?: boolean;
}

export interface HTTPValidationError {
  detail?: ValidationError[];
}

export interface ImportChoice {
  collection?: boolean;
  wantlist?: boolean;
}

export interface ListingReport {
  result: "present" | "missing" | "different_price";
  reported_price?: number | null;
}

export interface NearbyStockResponse {
  album_id: number;
  zip: string;
  radius_mi: number;
  center_lat: number;
  center_lng: number;
  stores: NearbyStore[];
  nearest_outside_mi: number | null;
  other_shops?: OtherShop[];
}

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
  missing_reports?: number;
  lat: number;
  lng: number;
  phone: string | null;
  source?: string;
  discogs_url?: string | null;
}

export interface NewCopy {
  media_grade?: string | null;
  sleeve_grade?: string | null;
  price_paid?: number | null;
  bought_at?: string | null;
  notes?: string | null;
  pressing_id: number;
  another_copy?: boolean;
}

export interface NewItem {
  pressing_id?: number | null;
  max_price?: number | null;
  min_condition?: string | null;
  album_id: number;
}

export interface OtherShop {
  store_id: number;
  name: string;
  area: string | null;
  distance_mi: number;
  phone: string | null;
  lat: number;
  lng: number;
}

export interface ResetBody {
  token: string;
  password: string;
}

export interface SettingsChange {
  username?: string | null;
  home_zip?: string | null;
  default_radius_mi?: 10 | 25 | 50 | 100 | null;
  theme?: "light" | "dark" | "system" | null;
  use_current_location?: boolean | null;
  privacy_profile?: "public" | "private" | null;
  privacy_collection?: "public" | "private" | null;
  privacy_wishlist?: "public" | "private" | null;
  favorite_genres?: string[] | null;
}

export interface ShopSighting {
  album_id: number;
  pressing_id: number;
  condition: "New" | "Used";
  price: number;
}

export interface TokenBody {
  token: string;
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export interface WishlistTarget {
  pressing_id?: number | null;
  max_price?: number | null;
  min_condition?: string | null;
}
