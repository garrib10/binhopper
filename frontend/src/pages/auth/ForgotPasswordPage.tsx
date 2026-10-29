import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api';
import { forgotPassword } from '../../auth';
import { AuthLayout, FormMessage, TextField } from '../../components/AuthForm';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { setMessage({ tone: 'ok', text: (await forgotPassword(email)).detail }); } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError && err.status < 500 ? err.message : "Can't reach Binhopper right now." });
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout title="Reset your password" intro="Enter your email and we'll send a link to choose a new password.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      <button className="button button--primary button--block" type="submit" disabled={busy}>Send reset link</button>
    </form>
    <p className="auth-links"><Link to="/sign-in">Back to sign in</Link></p>
  </AuthLayout>;
}
