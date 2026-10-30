import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../App';

function signedOutAt(path: string) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => new Response('{}',
    { status: String(input).startsWith('/api/auth/me') ? 401 : 404 }));
  return render(<MemoryRouter initialEntries={[path]}><AppShell /></MemoryRouter>);
}

describe('Privacy Policy and Terms of Use (#85)', () => {
  it('shows the privacy policy signed out, with the adults-only rule and the rights it promises', () => {
    signedOutAt('/privacy');
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Adults only, in the United States' })).toBeVisible();
    expect(screen.getByText(/Binhopper is for people 18 and older/)).toBeVisible();
    for (const name of ['Who helps run Binhopper', 'Your choices and rights', 'Cookies and browser storage']) {
      expect(screen.getByRole('heading', { name })).toBeVisible();
    }
    expect(screen.getByText(/We don't sell your\s+data/)).toBeVisible();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms');
  });

  it('shows the terms signed out: 18+, Connecticut law, stock is a guide', () => {
    signedOutAt('/terms');
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
    expect(screen.getByText('You must be 18 or older. Binhopper is meant for use in the United States.')).toBeVisible();
    expect(screen.getByText(/governed by the laws of the State of Connecticut/)).toBeVisible();
    expect(screen.getByText(/A guide, not a guarantee/)).toBeVisible();
    expect(within(screen.getByRole('main')).getAllByRole('link', { name: 'Privacy Policy' })[0]).toHaveAttribute('href', '/privacy');
  });

  it('says a contact address comes before launch rather than showing a made-up one', () => {
    signedOutAt('/privacy');
    expect(screen.getAllByText(/the contact address listed here before launch/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });

  it('links both pages from every screen footer', () => {
    signedOutAt('/search');
    const legal = screen.getByRole('navigation', { name: 'Legal' });
    expect(within(legal).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(within(legal).getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms');
  });

  it.each(['/create-account', '/sign-in'])('%s says continuing means 18+ and agreeing to both', async (path) => {
    signedOutAt(path);
    const notice = await screen.findByText(/By continuing, you confirm you're 18 or older/);
    expect(within(notice).getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms');
    expect(within(notice).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  });
});
