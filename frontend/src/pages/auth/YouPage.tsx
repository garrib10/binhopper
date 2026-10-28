import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { FormMessage } from '../../components/AuthForm';

/** You (account) until #42 builds the Profile/Settings/Privacy/Account tabs. */
export function YouPage() {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  if (state.status !== 'signed-in') return null;
  return <main id="content" className="page shell-page">
    <h1 className="display">You</h1>
    <p>Signed in as <strong>{state.account.email}</strong> ({state.account.username}).</p>
    <p className="muted">Profile, settings and privacy controls are coming soon. Everything you save starts as "Only me".</p>
    {error && <FormMessage tone="error">Couldn't sign out. Try again.</FormMessage>}
    <div><button type="button" className="button button--secondary" onClick={() => {
      signOut().then(() => navigate('/search')).catch(() => setError(true));
    }}>Sign out</button></div>
  </main>;
}
