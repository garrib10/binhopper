import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api';
import { MIN_PASSWORD, resetPassword, takeLinkToken } from '../../auth';
import { useAuth } from '../../AuthContext';
import { AuthLayout, FormMessage, PasswordField } from '../../components/AuthForm';

/** The emailed reset link lands here: /reset-password#token=… (AC-21). */
export function ResetPasswordPage() {
  const { setAccount } = useAuth();
  const [token] = useState(takeLinkToken);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(token ? null : 'This link is incomplete. Open it straight from the email.');
  const [expired, setExpired] = useState(!token);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters`); return; }
    setBusy(true); setError(null);
    try {
      setAccount(await resetPassword(token, password));
      setDone(true);
    } catch (err) {
      setExpired(err instanceof ApiError && err.status === 400);
      setError(err instanceof ApiError && err.status < 500 ? err.message : "Can't reach Binhopper right now.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <AuthLayout title="Password changed" intro="You're signed in. Anywhere else you were signed in has been signed out.">
    <Link className="button button--primary button--block" to="/search">Start searching</Link>
  </AuthLayout>;
  return <AuthLayout title="Choose a new password">
    {expired ? <>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Link className="button button--primary button--block" to="/forgot-password">Send a new link</Link>
    </> : <form className="auth-form" onSubmit={submit} noValidate>
      <PasswordField label="New password" autoComplete="new-password" required value={password}
        hint={`At least ${MIN_PASSWORD} characters.`} onChange={(e) => setPassword(e.target.value)} />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <button className="button button--primary button--block" type="submit" disabled={busy}>Save password</button>
    </form>}
  </AuthLayout>;
}
