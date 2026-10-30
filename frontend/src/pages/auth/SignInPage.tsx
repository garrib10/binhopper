import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api';
import { resendVerification, safeReturnTo, signIn } from '../../auth';
import { useAuth } from '../../AuthContext';
import { AuthLayout, FormMessage, GoogleButton, PasswordField, TextField } from '../../components/AuthForm';
import { LegalNotice } from '../../components/LegalNotice';

export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('return_to'));
  const navigate = useNavigate();
  const { setAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'google' ? "Google sign-in didn't finish. Try again." : null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setUnverified(false); setResent(null);
    try {
      setAccount(await signIn(email, password));
      navigate(returnTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === 'verify_email') setUnverified(true);
      else setError(err instanceof ApiError && err.status < 500 ? err.message : "Can't reach Binhopper right now.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try { setResent((await resendVerification(email)).detail); } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach Binhopper right now.");
    }
  }

  const createLink = `/create-account${returnTo === '/search' ? '' : `?return_to=${encodeURIComponent(returnTo)}`}`;
  return <AuthLayout title="Sign in" intro="Keep your wishlist and collection in one place.">
    <GoogleButton returnTo={returnTo} />
    <form className="auth-form" onSubmit={submit} noValidate>
      <TextField label="Email" type="email" autoComplete="email" required value={email}
        onChange={(e) => setEmail(e.target.value)} />
      <PasswordField label="Password" autoComplete="current-password" required value={password}
        onChange={(e) => setPassword(e.target.value)} />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {unverified && <FormMessage tone="error">Confirm your email first: open the link we sent when you
        signed up. <button type="button" className="text-button" onClick={resend}>Send a new link</button></FormMessage>}
      {resent && <FormMessage tone="ok">{resent}</FormMessage>}
      <button className="button button--primary button--block" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <LegalNotice />
    <p className="auth-links"><Link to="/forgot-password">Forgot password?</Link>
      <Link to={createLink}>Create an account</Link></p>
  </AuthLayout>;
}
