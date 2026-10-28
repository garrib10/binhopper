import { ApiError, errorDetail } from './api';

/** The signed-in account (GET /api/auth/me). */
export interface Account {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  sign_in_methods: ('password' | 'google')[];
}

/** Sent on every request that changes something; the API rejects those without it (#38). */
export const CSRF_HEADER = { 'X-Binhopper-CSRF': '1' } as const;

/** POST JSON to /api with the CSRF header. Session cookies ride along (same origin). */
export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { ...CSRF_HEADER, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = errorDetail(await response.json().catch(() => ({})));
    throw new ApiError(response.status, detail ?? 'Something went wrong. Try again.');
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** The current account, or null when signed out. */
export async function getMe(): Promise<Account | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (response.status === 401) return null;
  if (!response.ok) throw new ApiError(response.status, 'Unable to check sign-in');
  return response.json();
}

export async function getProviders(): Promise<{ google: boolean }> {
  const response = await fetch('/api/auth/providers');
  return response.ok ? response.json() : { google: false };
}

type Detail = { detail: string };
export const register = (email: string, password: string) => postJson<Detail>('/auth/register', { email, password });
export const verifyEmail = (token: string) => postJson<Account>('/auth/verify', { token });
export const resendVerification = (email: string) => postJson<Detail>('/auth/resend-verification', { email });
export const signIn = (email: string, password: string) => postJson<Account>('/auth/sign-in', { email, password });
export const signOut = () => postJson<void>('/auth/sign-out');
export const forgotPassword = (email: string) => postJson<Detail>('/auth/forgot-password', { email });
export const resetPassword = (token: string, password: string) =>
  postJson<Account>('/auth/reset-password', { token, password });

export const MIN_PASSWORD = 10;

/** Only paths on this site, so "back to where you were" can't send anyone elsewhere. */
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/search';
  return value;
}

/** Read `#token=…` from an emailed link, then drop it from the address bar and history. */
export function takeLinkToken(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  return token;
}
