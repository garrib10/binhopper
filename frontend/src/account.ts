import { ApiError, errorDetail } from './api';
import { sendJson } from './auth';
import type { ThemePreference } from './theme';

export type Visibility = 'public' | 'private';

export interface AccountSettings {
  username: string;
  email: string;
  sign_in_methods: ('password' | 'google')[];
  home_zip: string | null;
  default_radius_mi: 10 | 25 | 50 | 100;
  theme: ThemePreference;
  use_current_location: boolean;
  privacy_profile: Visibility;
  privacy_collection: Visibility;
  privacy_wishlist: Visibility;
  favorite_genres: string[];
  genres: string[];
}

export type SettingsChange = Partial<Omit<AccountSettings, 'email' | 'sign_in_methods' | 'genres'>>;

export async function fetchSettings(signal?: AbortSignal): Promise<AccountSettings> {
  const response = await fetch('/api/me/settings', { credentials: 'same-origin', signal });
  if (!response.ok) throw new ApiError(response.status, errorDetail(await response.json().catch(() => ({}))) ?? 'Unable to load your settings');
  return response.json();
}

export const saveSettings = (change: SettingsChange) => sendJson<AccountSettings>('PATCH', '/me/settings', change);
export const deleteAccount = () => sendJson<void>('DELETE', '/me');

/** "crate_digger" → "CR"; "collector-ab12cd" → "CA" (the avatar until photo uploads). */
export function initials(username: string): string {
  const parts = username.split(/[-_.\s]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : username.slice(0, 2);
  return letters.toUpperCase();
}
