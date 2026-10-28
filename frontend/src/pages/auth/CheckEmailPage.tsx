import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../../api';
import { resendVerification } from '../../auth';
import { AuthLayout, FormMessage } from '../../components/AuthForm';

export function CheckEmailPage() {
  const email: string | undefined = useLocation().state?.email;
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function resend() {
    if (!email) return;
    try { setMessage({ tone: 'ok', text: (await resendVerification(email)).detail }); } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : "Can't reach Binhopper right now." });
    }
  }

  return <AuthLayout title="Check your email"
    intro={<>We sent a link to {email ? <strong>{email}</strong> : 'your email'}. Open it to finish signing up. It works for 24 hours.</>}>
    <p className="muted">Nothing there? Check your spam folder.</p>
    {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
    <p className="auth-links">
      {email && <button type="button" className="text-button" onClick={resend}>Resend email</button>}
      <Link to="/create-account">Use a different email</Link>
    </p>
  </AuthLayout>;
}
