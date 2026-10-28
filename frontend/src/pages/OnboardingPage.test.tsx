import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingPage } from './OnboardingPage';

const settings = { username: 'collector-1', email: 'a@example.com', sign_in_methods: ['password'], home_zip: null,
  default_radius_mi: 25, theme: 'system', use_current_location: false, privacy_profile: 'private',
  privacy_collection: 'private', privacy_wishlist: 'private', favorite_genres: [], genres: ['Rock', 'Jazz', 'Folk'] };

function api(nearest: { status: number; body: unknown } = { status: 200, body: { zip: '10003' } }) {
  const patches: unknown[] = [];
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/me/settings' && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      patches.push(body);
      if (body.home_zip === '99999') return new Response(JSON.stringify({ detail: "We don't have that ZIP yet. Check it or try a nearby one." }), { status: 422 });
      return new Response(JSON.stringify({ ...settings, ...body }));
    }
    if (url === '/api/me/settings') return new Response(JSON.stringify(settings));
    if (url.startsWith('/api/zips/nearest')) return new Response(JSON.stringify(nearest.body), { status: nearest.status });
    return new Response('{}', { status: 404 });
  });
  return { fetch, patches };
}

function geolocation(result: 'allow' | 'deny') {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => result === 'allow'
      ? ok({ coords: { latitude: 40.7317, longitude: -73.9891 } } as GeolocationPosition)
      : fail({ code: 1, message: 'denied' } as GeolocationPositionError),
  } });
}

function renderAt(path = '/onboarding?return_to=%2Fwishlist') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/wishlist" element={<p>Wishlist page</p>} />
  </Routes></MemoryRouter>);
}

afterEach(() => { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }); });

describe('Onboarding', () => {
  it('walks through 4 steps, saving location, radius and genres, then skips to where you were going', async () => {
    const { patches } = api();
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Where do you dig?' })).toBeVisible();
    expect(screen.getByText('Step 1 of 4')).toBeVisible();
    await userEvent.clear(screen.getByLabelText('Enter a ZIP code'));
    await userEvent.type(screen.getByLabelText('Enter a ZIP code'), '10011');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'How far will you go?' })).toHaveFocus();
    expect(screen.getByRole('button', { name: /25 mi/ })).toHaveAttribute('aria-pressed', 'true');  // default 25
    await userEvent.click(screen.getByRole('button', { name: /50 mi/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'What do you spin?' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Jazz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Got records already?' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Import from Discogs/ })).toHaveAttribute('href', '/import');
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByText('Wishlist page')).toBeVisible();
    expect(patches).toEqual([{ home_zip: '10011' }, { default_radius_mi: 50 }, { favorite_genres: ['Jazz'] }]);
    expect(JSON.parse(localStorage.getItem('binhopper.location')!)).toEqual({ zip: '10011', radius: 50 });
  });

  it('requires a 5-digit ZIP and shows the API’s message for an unknown one', async () => {
    const { patches } = api();
    renderAt();
    const field = await screen.findByLabelText('Enter a ZIP code');
    await userEvent.clear(field);
    await userEvent.type(field, '123');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a 5-digit ZIP code');
    expect(patches).toEqual([]);
    await userEvent.clear(field);
    await userEvent.type(field, '99999');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We don't have that ZIP yet");
    expect(screen.getByRole('heading', { name: 'Where do you dig?' })).toBeVisible();
  });

  it('"Use my location" fills in the nearest ZIP', async () => {
    const { fetch } = api();
    geolocation('allow');
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: 'Use my location' }));
    await waitFor(() => expect(screen.getByLabelText('Enter a ZIP code')).toHaveValue('10003'));
    expect(fetch).toHaveBeenCalledWith('/api/zips/nearest?lat=40.7317&lng=-73.9891');
  });

  it('when location is denied, the ZIP still works (LocationDenied)', async () => {
    const { fetch } = api();
    geolocation('deny');
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: 'Use my location' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Location is off');
    expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/zips'))).toBe(false);
    expect(screen.getByLabelText('Enter a ZIP code')).toBeEnabled();
  });

  it('Back returns to the previous step', async () => {
    api();
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Where do you dig?' })).toBeVisible();
  });
});
