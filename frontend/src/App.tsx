import { useEffect, useState, type ReactElement } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ThemePicker } from './components/ThemePicker';
import { SearchPage } from './pages/SearchPage';
import { ArtistPage } from './pages/ArtistPage';
import { AlbumPage } from './pages/AlbumPage';
import { NearbyStockPage } from './pages/NearbyStockPage';
import { applyTheme, loadThemePreference, saveThemePreference, type ThemePreference } from './theme';
import { loadLocation, saveLocation } from './location';
import { AuthProvider, RequireAuth, useAuth } from './AuthContext';
import { SignInPage } from './pages/auth/SignInPage';
import { CreateAccountPage } from './pages/auth/CreateAccountPage';
import { CheckEmailPage } from './pages/auth/CheckEmailPage';
import { VerifyPage } from './pages/auth/VerifyPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { YouPage } from './pages/auth/YouPage';

export function App() { return <BrowserRouter><AuthProvider><AppShell /></AuthProvider></BrowserRouter>; }

export function Placeholder({ title }: { title: string }) {
  return <main id="content" className="page shell-page"><h1 className="display">{title}</h1>
    <p className="muted">This part of Binhopper is coming soon.</p>
    <nav aria-label="Explore Binhopper" className="explore-links">
      <Link to="/search">Search records</Link><Link to="/genres">Browse genres</Link>
      <Link to="/genres/Rock/years">Browse years</Link><Link to="/albums/1">Sample album</Link><Link to="/artists/1">Sample artist</Link>
      <Link to="/albums/1/stores">Find nearby stock</Link><Link to="/import">Import from Discogs</Link>
      <Link to="/collection/1">Your copy</Link><Link to="/records/1">Locate, hold or buy</Link>
      <Link to="/onboarding">Get started</Link><Link to="/stock/1/report">Report stock</Link>
    </nav></main>;
}

function NearbyRoute() {
  const { id = '' } = useParams();
  const [saved] = useState(loadLocation);
  if (!/^[1-9]\d*$/.test(id)) return <NotFound />;
  return <NearbyStockPage key={id} albumId={Number(id)} albumTitle={id === '1' ? 'Rumours' : 'Nearby stock'}
    artistName={id === '1' ? 'Fleetwood Mac' : ''} initialZip={saved.zip} initialRadius={saved.radius}
    onLocationChange={saveLocation} />;
}

function NotFound() {
  return <main id="content" className="page shell-page"><h1 className="display">Page not found</h1>
    <p>That record may have skipped. <Link to="/search">Back to search</Link>.</p></main>;
}

/** Signed out: "Sign in". Signed in: the "You" button (account and settings). */
function ProfileLink() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <span className="profile-link profile-link--pending" aria-hidden="true" />;
  if (state.status === 'signed-out') {
    const here = location.pathname + location.search;
    const authScreen = /^\/(sign-in|create-account|check-email|verify|forgot-password|reset-password)/.test(location.pathname);
    return <Link className="profile-link profile-link--text"
      to={authScreen ? '/sign-in' : `/sign-in?return_to=${encodeURIComponent(here)}`}>Sign in</Link>;
  }
  return <NavLink className="profile-link" to="/you" aria-label="You: account and settings">You</NavLink>;
}

const signedIn = (element: ReactElement) => <RequireAuth>{element}</RequireAuth>;

function SearchEntry() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(params.get('q') ?? '');
  useEffect(() => { setQuery(params.get('q') ?? ''); }, [params]);
  return <form className="header-search" role="search" onSubmit={(event) => {
    event.preventDefault(); navigate(`/search?q=${encodeURIComponent(query)}`);
  }}><label htmlFor="global-search" className="sr-only">Search records</label>
    <input id="global-search" type="search" value={query} placeholder="Artist, album, label…"
      onChange={(event) => {
        setQuery(event.target.value);
        if (location.pathname === '/search') {
          const next = new URLSearchParams(params); next.set('q', event.target.value); next.delete('offset');
          navigate(`/search?${next}`, { replace: true });
        }
      }} /><button type="submit" aria-label="Search">↗</button></form>;
}

export function AppShell() {
  const [theme, setTheme] = useState<ThemePreference>(loadThemePreference);
  useEffect(() => { applyTheme(theme); saveThemePreference(theme); }, [theme]);
  return <>
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="app-header"><div className="shell-header">
      <Link className="app-header__brand" to="/search"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></svg>Binhopper</Link>
      <SearchEntry />
      <nav aria-label="Main" className="main-nav">
        <NavLink to="/search">Search</NavLink><NavLink to="/wishlist">Wishlist</NavLink>
        <NavLink to="/albums/1/stores">Nearby</NavLink><NavLink to="/collection" end>Collection</NavLink>
      </nav>
      <ProfileLink />
      <ThemePicker value={theme} onChange={setTheme} />
    </div></header>
    <Routes>
      <Route path="/" element={<Navigate to="/search" replace />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/genres" element={<SearchPage />} />
      <Route path="/genres/:genre/years" element={<SearchPage />} />
      <Route path="/artists/:id" element={<ArtistPage />} />
      <Route path="/albums/:id" element={<AlbumPage />} />
      <Route path="/albums/:id/stores" element={<NearbyRoute />} />
      <Route path="/records/:id" element={<Placeholder title="Locate, hold or buy" />} />
      <Route path="/wishlist" element={signedIn(<Placeholder title="Wishlist" />)} />
      <Route path="/collection" element={signedIn(<Placeholder title="Collection" />)} />
      <Route path="/collection/:id" element={signedIn(<Placeholder title="Your copy" />)} />
      <Route path="/import" element={signedIn(<Placeholder title="Import from Discogs" />)} />
      <Route path="/you/*" element={signedIn(<YouPage />)} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/check-email" element={<CheckEmailPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/onboarding" element={<Placeholder title="Get started" />} />
      <Route path="/stock/:id/report" element={<Placeholder title="Report stock" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <footer className="app-data-credit">Shop locations and map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.</footer>
  </>;
}
