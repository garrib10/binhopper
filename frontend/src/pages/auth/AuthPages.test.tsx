import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../App';
import { AuthProvider } from '../../AuthContext';
import { SignInPage } from './SignInPage';
import { CreateAccountPage } from './CreateAccountPage';
import { VerifyPage } from './VerifyPage';
import { ResetPasswordPage } from './ResetPasswordPage';

const account = { id: 1, username: 'collector-abc123', email: 'a@example.com', email_verified: true,
  sign_in_methods: ['password'] };

type Reply = { status: number; body?: unknown };
/** Fake API: answers by path; GET /api/auth/me is signed out unless given. */
function api(replies: Record<string, Reply>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input).split('?')[0];
    const reply = replies[path] ?? (path === '/api/auth/me' ? { status: 401, body: {} }
      : path === '/api/auth/providers' ? { status: 200, body: { google: false } } : { status: 404, body: {} });
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), { status: reply.status });
  });
}

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; }

function renderAt(path: string, element: React.ReactNode, route = path.split(/[?#]/)[0]) {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider>
    <Routes><Route path={route} element={element} /><Route path="*" element={<Where />} /></Routes>
  </AuthProvider></MemoryRouter>);
}

describe('Sign in', () => {
  it('signs in and returns to where the user was', async () => {
    const fetch = api({ '/api/auth/sign-in': { status: 200, body: account } });
    renderAt('/sign-in?return_to=%2Fwishlist', <SignInPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/wishlist');
    expect(fetch).toHaveBeenCalledWith('/api/auth/sign-in', expect.objectContaining({
      body: JSON.stringify({ email: 'a@example.com', password: 'long-enough-1' }) }));
  });

  it('AC-20 shows one message for a wrong email or password', async () => {
    api({ '/api/auth/sign-in': { status: 401, body: { detail: 'Email or password is incorrect' } } });
    renderAt('/sign-in', <SignInPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('offers a new link when the email is not confirmed yet', async () => {
    const fetch = api({
      '/api/auth/sign-in': { status: 403, body: { detail: 'verify_email' } },
      '/api/auth/resend-verification': { status: 202, body: { detail: "If that email is waiting to be confirmed, we've sent a new link." } },
    });
    renderAt('/sign-in', <SignInPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send a new link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('sent a new link');
    expect(fetch).toHaveBeenCalledWith('/api/auth/resend-verification', expect.anything());
  });

  it('shows the Google button only when Google sign-in is set up', async () => {
    api({ '/api/auth/providers': { status: 200, body: { google: true } } });
    renderAt('/sign-in?return_to=%2Fcollection', <SignInPage />);
    expect(await screen.findByRole('link', { name: 'Continue with Google' }))
      .toHaveAttribute('href', '/api/auth/google/start?return_to=%2Fcollection');
  });

  it('explains a Google sign-in that did not finish', () => {
    api({});
    renderAt('/sign-in?error=google', <SignInPage />);
    expect(screen.getByRole('alert')).toHaveTextContent("Google sign-in didn't finish");
  });
});

describe('Create account', () => {
  it('checks the password length before sending anything', async () => {
    const fetch = api({});
    renderAt('/create-account', <CreateAccountPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 10 characters');
    expect(fetch).not.toHaveBeenCalledWith('/api/auth/register', expect.anything());
  });

  it('goes to "Check your email" after signing up', async () => {
    api({ '/api/auth/register': { status: 202, body: { detail: 'Check your email' } } });
    renderAt('/create-account', <CreateAccountPage />);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/At least 10 characters/);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-1');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/check-email');
  });
});

describe('Emailed links', () => {
  it('AC-19 verifies the link once and signs in', async () => {
    window.history.replaceState(null, '', '/verify#token=tok-1');
    const fetch = api({ '/api/auth/verify': { status: 200, body: account } });
    renderAt('/verify', <VerifyPage />);
    expect(await screen.findByRole('heading', { name: "You're signed in" })).toBeVisible();
    const verifies = fetch.mock.calls.filter(([url]) => url === '/api/auth/verify');
    expect(verifies).toHaveLength(1);
    expect(verifies[0][1]?.body).toBe(JSON.stringify({ token: 'tok-1' }));
    expect(window.location.hash).toBe('');
  });

  it('AC-19 explains a used or expired link and offers a new one', async () => {
    window.history.replaceState(null, '', '/verify#token=old');
    api({ '/api/auth/verify': { status: 400, body: { detail: 'This link has expired or was already used' } } });
    renderAt('/verify', <VerifyPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('expired or was already used');
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeVisible();
  });

  it('AC-21 sets a new password from the reset link', async () => {
    window.history.replaceState(null, '', '/reset-password#token=reset-1');
    const fetch = api({ '/api/auth/reset-password': { status: 200, body: account } });
    renderAt('/reset-password', <ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText('New password'), 'a-brand-new-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeVisible();
    expect(fetch).toHaveBeenCalledWith('/api/auth/reset-password', expect.objectContaining({
      body: JSON.stringify({ token: 'reset-1', password: 'a-brand-new-pass' }) }));
  });
});

describe('Header and signed-in screens', () => {
  it('shows "Sign in" when signed out, and protected pages send you to sign in', async () => {
    api({});
    render(<MemoryRouter initialEntries={['/wishlist']}><AuthProvider><AppShell /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Sign in' }, { timeout: 5000 })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('shows "You" when signed in and signs out from the You page', async () => {
    const fetch = api({ '/api/auth/me': { status: 200, body: account }, '/api/auth/sign-out': { status: 204 } });
    render(<MemoryRouter initialEntries={['/you']}><AuthProvider><AppShell /></AuthProvider></MemoryRouter>);
    expect(await screen.findByText('a@example.com')).toBeVisible();
    expect(screen.getByRole('link', { name: 'You: account and settings' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible());
    expect(fetch).toHaveBeenCalledWith('/api/auth/sign-out', expect.objectContaining({ method: 'POST' }));
  });
});
