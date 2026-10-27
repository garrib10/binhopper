import { isValidZip, RADII, type Radius } from './api';

export interface LocationPreferences { zip: string; radius: Radius }
const KEY = 'binhopper.location';
const DEFAULTS: LocationPreferences = { zip: '10011', radius: 25 };

export function loadLocation(): LocationPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved.zip === 'string' && isValidZip(saved.zip) && RADII.includes(saved.radius)) {
      return { zip: saved.zip, radius: saved.radius };
    }
  } catch { /* Storage can be unavailable in private browsers. */ }
  return { ...DEFAULTS };
}

export function saveLocation(zip: string, radius: Radius) {
  try { localStorage.setItem(KEY, JSON.stringify({ zip, radius })); } catch { /* Optional persistence. */ }
}
