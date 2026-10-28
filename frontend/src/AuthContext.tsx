import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getMe, signOut as postSignOut, type Account } from './auth';

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; account: Account };

interface AuthValue {
  state: AuthState;
  setAccount: (account: Account | null) => void;
  signOut: () => Promise<void>;
}

// Outside <AuthProvider> (component tests of other screens) everyone is signed out.
const AuthContext = createContext<AuthValue>({
  state: { status: 'signed-out' }, setAccount: () => {}, signOut: async () => {},
});

/** Asks the API once who is signed in, and shares the answer with the whole app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    getMe()
      .then((account) => { if (active) setState(account ? { status: 'signed-in', account } : { status: 'signed-out' }); })
      .catch(() => { if (active) setState({ status: 'signed-out' }); });
    return () => { active = false; };
  }, []);
  const setAccount = useCallback((account: Account | null) => {
    setState(account ? { status: 'signed-in', account } : { status: 'signed-out' });
  }, []);
  const signOut = useCallback(async () => {
    await postSignOut();
    setState({ status: 'signed-out' });
  }, []);
  const value = useMemo(() => ({ state, setAccount, signOut }), [state, setAccount, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}

/** Signed-in-only screens: anyone signed out goes to sign in, then comes back here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <main id="content" className="page shell-page" aria-busy="true" />;
  if (state.status === 'signed-out') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?return_to=${returnTo}`} replace />;
  }
  return <>{children}</>;
}
