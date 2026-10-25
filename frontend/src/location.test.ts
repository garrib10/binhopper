import { afterEach, expect, it, vi } from 'vitest';
import { loadLocation, saveLocation } from './location';
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it('persists only valid ZIP and radius preferences', () => {
  saveLocation('06010', 50);
  expect(loadLocation()).toEqual({ zip: '06010', radius: 50 });
  localStorage.setItem('binhopper.location', '{"zip":"bad","radius":7}');
  expect(loadLocation()).toEqual({ zip: '10011', radius: 25 });
});
it('survives unavailable and malformed storage', () => {
  localStorage.setItem('binhopper.location', '{');
  expect(loadLocation().radius).toBe(25);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  expect(() => saveLocation('10011', 25)).not.toThrow();
});
