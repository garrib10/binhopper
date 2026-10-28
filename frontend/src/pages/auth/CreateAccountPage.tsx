import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api';
import { MIN_PASSWORD, register, safeReturnTo } from '../../auth';
import { AuthLayout, FormMessage, GoogleButton, PasswordField, TextField } from '../../components/AuthForm';

export function CreateAccountPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters`); return; }
    setBusy(true); setError(null);
    try {
      await register(email, password);
      navigate('/check-email', { state: { email } });
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : "Can't reach Binhopper right now.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout title="Create an account" intro="Your profile, wishlist and collection start private: only you can see them.">
    <GoogleButton returnTo={safeReturnTo(params.get('return_to'))} />
    <form className="auth-form" onSubmit={submit} noValidate>
      <TextField label="Email" type="email" autoComplete="email" required value={email}
        onChange={(e) => setEmail(e.target.value)} />
      <PasswordField label="Password" autoComplete="new-password" required value={password}
        hint={`At least ${MIN_PASSWORD} characters. A short phrase works well.`}
        onChange={(e) => setPassword(e.target.value)} />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <button className="button button--primary button--block" type="submit" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}</button>
    </form>
    <p className="auth-links">Already have an account? <Link to="/sign-in">Sign in</Link></p>
  </AuthLayout>;
}
