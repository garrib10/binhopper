import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { initials, type AccountSettings } from '../account';
import { AuthProvider } from '../AuthContext';
import { ThemeContext } from '../ThemeContext';
import { YouPage } from './YouPage';

const settings: AccountSettings = { username: 'crate_digger', email: 'collector@example.com', sign_in_methods: ['password'],
  home_zip: '10011', default_radius_mi: 25, theme: 'system', use_current_location: false, privacy_profile: 'private',
  privacy_collection: 'private', privacy_wishlist: 'private', favorite_genres: ['Rock'], genres: ['Rock', 'Jazz', 'Folk'] };
const account = { id: 1, username: 'crate_digger', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] };

function api(patch?: (body: Record<string, unknown>) => { status?: number; body?: unknown }) {
  let current = { ...settings };
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    if (key === 'GET /api/auth/me') return new Response(JSON.stringify(account));
    if (key === 'GET /api/me/settings') return new Response(JSON.stringify(current));
    if (key === 'PATCH /api/me/settings') {
      const body = JSON.parse(String(init?.body));
      const reply = patch?.(body);
      if (reply?.status) return new Response(JSON.stringify(reply.body), { status: reply.status });
      current = { ...current, ...body };
      return new Response(JSON.stringify(current));
    }
    if (key === 'DELETE /api/me') return new Response(null, { status: 204 });
    return new Response('{}', { status: 404 });
  });
}

function renderAt(path: string, setTheme = vi.fn()) {
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><ThemeContext.Provider value={{ theme: 'system', setTheme }}>
    <Routes><Route path="/you/:tab" element={<YouPage />} /><Route path="/you" element={<YouPage />} /><Route path="/search" element={<p>Search page</p>} /></Routes>
  </ThemeContext.Provider></AuthProvider></MemoryRouter>);
  return setTheme;
}

describe('You', () => {
  it('has four tabs (Notifications waits for v1.1) and arrow keys move between them', async () => {
    api();
    renderAt('/you');
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Profile', 'Settings', 'Privacy', 'Account']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    tabs[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByRole('tab', { name: 'Settings', selected: true })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Settings');
  });

  it('AC-13 privacy starts at "Only me" and offers Everyone or Only me', async () => {
    const fetch = api();
    renderAt('/you/privacy');
    const collection = await screen.findByRole('group', { name: 'My collection' });
    expect(within(collection).getByRole('button', { name: 'Only me' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(collection).queryByRole('button', { name: 'Friends' })).toBeNull();
    await userEvent.click(within(collection).getByRole('button', { name: 'Everyone' }));
    expect(await screen.findByRole('status')).toHaveTextContent('My collection: Everyone');
    expect(fetch).toHaveBeenCalledWith('/api/me/settings', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ privacy_collection: 'public' }) }));
    expect(screen.getByRole('link', { name: /Export my collection/ })).toHaveAttribute('href', '/api/me/export');
    expect(screen.getByRole('link', { name: /Download all my data/ })).toHaveAttribute('href', '/api/me/data');
  });

  it('AC-14 Appearance sets the theme and saves it', async () => {
    const fetch = api();
    const setTheme = renderAt('/you/settings');
    await userEvent.click(within(await screen.findByRole('group', { name: 'Appearance' })).getByRole('button', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/me/settings', expect.objectContaining({ body: JSON.stringify({ theme: 'dark' }) })));
  });

  it('saves home ZIP and radius, and remembers them for search and nearby stock', async () => {
    api();
    renderAt('/you/settings');
    const zip = await screen.findByLabelText('Home ZIP');
    await userEvent.clear(zip);
    await userEvent.type(zip, '0603');
    await userEvent.click(screen.getByRole('button', { name: 'Save ZIP' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a 5-digit ZIP code');
    await userEvent.type(zip, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Save ZIP' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Home ZIP saved');
    await userEvent.click(screen.getByRole('button', { name: '50 mi' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('binhopper.location')!)).toEqual({ zip: '06037', radius: 50 }));
  });

  it('shows why a username was not saved', async () => {
    api(() => ({ status: 409, body: { detail: 'That username is taken' } }));
    renderAt('/you/profile');
    await userEvent.click(await screen.findByRole('button', { name: 'Save username' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken');
  });

  it('AC-15 delete asks first, then deletes and signs out', async () => {
    const fetch = api();
    renderAt('/you/account');
    expect(await screen.findByText('collector@example.com')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete your account?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep account' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
    expect(await screen.findByText('Search page')).toBeVisible();
    expect(fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'DELETE' }));
  });
});

it('makes initials from usernames', () => {
  expect(['crate_digger', 'collector-ab12cd', 'jo'].map(initials)).toEqual(['CD', 'CA', 'JO']);
});
