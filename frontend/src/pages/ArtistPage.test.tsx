import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ArtistPage } from './ArtistPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
it('expands biography, keeps Follow disabled and switches release groups', async () => {
  const bio = 'A catalog biography. '.repeat(20);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 1, name: 'Fleetwood Mac', bio,
    origin: 'London', image_url: null, genres: ['Rock'], discogs_url: 'https://www.discogs.com/artist/1',
    discography: { Studio: [], Live: [], Compilations: [] } })));
  render(<MemoryRouter initialEntries={['/artists/1']}><Routes><Route path="/artists/:id" element={<ArtistPage />} /></Routes></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Fleetwood Mac' });
  expect(screen.getByRole('button', { name: 'Sign in to follow' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Read full bio' }));
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById('artist-bio')?.textContent).toBe(bio);
  fireEvent.click(screen.getByRole('button', { name: /^Live$/ }));
  expect(screen.getByText('No live releases listed yet.')).toBeVisible();
});
