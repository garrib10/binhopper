import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api';
import { resendVerification, takeLinkToken, verifyEmail } from '../../auth';
import { useAuth } from '../../AuthContext';
import { AuthLayout, FormMessage, TextField } from '../../components/AuthForm';

type State = { kind: 'checking' } | { kind: 'done' } | { kind: 'failed'; message: string };

/** The emailed sign-up link lands here: /verify#token=… (AC-19). */
export function VerifyPage() {
  const { setAccount } = useAuth();
  const [state, setState] = useState<State>({ kind: 'checking' });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // a link works once: never send it twice
    started.current = true;
    const token = takeLinkToken();
    if (!token) { setState({ kind: 'failed', message: 'This link is incomplete. Open it straight from the email.' }); return; }
    verifyEmail(token)
      .then((account) => { setAccount(account); setState({ kind: 'done' }); })
      .catch((err) => setState({ kind: 'failed', message: err instanceof ApiError && err.status < 500
        ? err.message : "Can't reach Binhopper right now." }));
  }, [setAccount]);

  if (state.kind === 'checking') return <AuthLayout title="Confirming your email"><p className="muted" role="status">One moment…</p></AuthLayout>;
  if (state.kind === 'done') return <AuthLayout title="You're signed in" intro="Your email is confirmed.">
    <Link className="button button--primary button--block" to="/search">Start searching</Link>
  </AuthLayout>;
  return <AuthLayout title="Link didn't work">
    <FormMessage tone="error">{state.message}</FormMessage>
    <ResendForm />
  </AuthLayout>;
}

function ResendForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try { setSent((await resendVerification(email)).detail); } catch (err) {
      setSent(err instanceof ApiError ? err.message : "Can't reach Binhopper right now.");
    }
  }
  return <form className="auth-form" onSubmit={submit}>
    <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
    {sent && <FormMessage tone="ok">{sent}</FormMessage>}
    <button className="button button--primary button--block" type="submit">Send a new link</button>
  </form>;
}
