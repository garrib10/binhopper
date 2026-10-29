import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportJob, ImportStatus } from '../discogsImport';
import { ImportPage } from './ImportPage';

const job = (over: Partial<ImportJob>): ImportJob => ({ id: 1, status: 'queued', added: 0, wishlisted: 0, skipped: 0,
  looking_up: 0, not_found: 0, error: null, ...over });

function api(statuses: ImportStatus[], post?: () => Response) {
  let i = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (init?.method === 'POST') return post ? post() : new Response(JSON.stringify(job({})), { status: 202 });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (String(input) === '/api/me/import/discogs') return new Response(JSON.stringify(statuses[Math.min(i++, statuses.length - 1)]));
    return new Response('{}', { status: 404 });
  });
}

const renderPage = (path = '/import') => render(<MemoryRouter initialEntries={[path]}><ImportPage /></MemoryRouter>);
afterEach(() => vi.useRealTimers());

describe('Import from Discogs', () => {
  it('offers to connect Discogs first', async () => {
    api([{ configured: true, connected: false, username: null, job: null }]);
    renderPage();
    expect(await screen.findByRole('link', { name: 'Connect Discogs' })).toHaveAttribute('href', '/api/discogs/connect');
  });

  it('says when the server has no Discogs app set up', async () => {
    api([{ configured: false, connected: false, username: null, job: null }]);
    renderPage();
    expect(await screen.findByText("Discogs import isn't set up on this server yet.")).toBeVisible();
  });

  it('explains a connection that didn’t finish', async () => {
    api([{ configured: true, connected: false, username: null, job: null }]);
    renderPage('/import?error=discogs');
    expect(await screen.findByRole('alert')).toHaveTextContent("Connecting to Discogs didn't finish");
  });

  it('starts an import of the chosen lists and shows progress until the summary', async () => {
    const fetch = api([
      { configured: true, connected: true, username: 'crate_digger', job: null },
      { configured: true, connected: true, username: 'crate_digger', job: job({ status: 'running', added: 40, wishlisted: 3, skipped: 1, looking_up: 2 }) },
      { configured: true, connected: true, username: 'crate_digger', job: job({ status: 'done', added: 212, wishlisted: 38, skipped: 4 }) },
    ]);
    renderPage();
    expect(await screen.findByText('crate_digger')).toBeVisible();
    await userEvent.click(screen.getByRole('checkbox', { name: /Wantlist/ }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(fetch).toHaveBeenCalledWith('/api/me/import/discogs', expect.objectContaining({ method: 'POST', body: JSON.stringify({ collection: true, wantlist: false }) }));
    expect(await screen.findByText(/40 added to your collection · 3 to your wishlist · 1 skipped · 2 being looked up/)).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(await screen.findByRole('heading', { name: 'Import complete' })).toBeVisible();
    expect(screen.getByText('Added to collection').nextSibling).toHaveTextContent('212');
    expect(screen.getByText('Duplicates skipped').nextSibling).toHaveTextContent('4');
  });

  it('asks for at least one list', async () => {
    api([{ configured: true, connected: true, username: 'crate_digger', job: null }]);
    renderPage();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Collection/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Wantlist/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your collection, your wantlist or both');
  });

  it('shows why an import stopped', async () => {
    api([{ configured: true, connected: true, username: 'crate_digger',
      job: job({ status: 'failed', error: "Discogs didn't accept the connection. Connect again, then retry." }) }]);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connect again');
  });
});
