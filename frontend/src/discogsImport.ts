import { ApiError, errorDetail } from './api';
import { sendJson } from './auth';

export interface ImportJob {
  id: number;
  status: 'queued' | 'running' | 'done' | 'failed';
  added: number;
  wishlisted: number;
  skipped: number;
  looking_up: number;
  not_found: number;
  error: string | null;
}

export interface ImportStatus { configured: boolean; connected: boolean; username: string | null; job: ImportJob | null }

export async function fetchImportStatus(signal?: AbortSignal): Promise<ImportStatus> {
  const response = await fetch('/api/me/import/discogs', { credentials: 'same-origin', signal });
  if (!response.ok) throw new ApiError(response.status, errorDetail(await response.json().catch(() => ({}))) ?? 'Unable to load');
  return response.json();
}

export const startImport = (collection: boolean, wantlist: boolean) =>
  sendJson<ImportJob>('POST', '/me/import/discogs', { collection, wantlist });
export const disconnectDiscogs = () => sendJson<void>('DELETE', '/me/discogs');
export const isActive = (job: ImportJob | null) => job?.status === 'queued' || job?.status === 'running';
