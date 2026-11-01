import { startTransition, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, isValidZip, RADII, type Radius } from '../api';
import {
  deleteAccount, fetchSettings, initials, saveSettings,
  type AccountSettings, type SettingsChange, type Visibility,
} from '../account';
import { useAuth } from '../AuthContext';
import { FormMessage } from '../components/AuthForm';
import { saveLocation } from '../location';
import type { ThemePreference } from '../theme';
import { useTheme } from '../ThemeContext';
import { PagePlaceholder } from '../components/PagePlaceholder';
import { peek, prefetch, share } from '../pageData';

// Notifications (desktop's fifth tab) arrives with alerts in v1.1.
const TABS = [['profile', 'Profile'], ['settings', 'Settings'], ['privacy', 'Privacy'], ['account', 'Account']] as const;
type Tab = (typeof TABS)[number][0];
const LOOKS: [ThemePreference, string][] = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Match system']];
const AREAS = [['privacy_profile', 'My profile'], ['privacy_collection', 'My collection'], ['privacy_wishlist', 'My wishlist']] as const;
const WHO: [Visibility, string][] = [['public', 'Everyone'], ['private', 'Only me']];

/** You: account and settings (SPEC.md › Account settings; mockups You.dc.html, DesktopYou.dc.html). */
export function YouPage() {
  const { tab: param } = useParams();
  const navigate = useNavigate();
  const tab: Tab = TABS.some(([key]) => key === param) ? (param as Tab) : 'profile';
  // Usually fetched already (the header's You link loads it early), so the page draws at once.
  const [settings, setSettings] = useState<AccountSettings | null>(() => peek<AccountSettings>('settings') ?? null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  useEffect(() => {
    let active = true;
    prefetch('settings', () => fetchSettings()).then((fresh) => { if (active) setSettings(fresh); })
      .catch(() => { if (active && peek('settings') === undefined) setError("Can't reach Binhopper right now."); });
    return () => { active = false; };
  }, [attempt]);

  const go = (next: Tab) => navigate(`/you/${next}`, { replace: true });
  function arrows(event: KeyboardEvent) {  // WAI-ARIA tabs: arrows move between tabs
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const index = (TABS.findIndex(([key]) => key === tab) + keys[event.key] + TABS.length) % TABS.length;
    go(TABS[index][0]);
    tabRefs.current[TABS[index][0]]?.focus();
  }

  if (!settings) return <main id="content" className="page shell-page"><h1 className="display">You</h1>
    {error ? <><p role="alert">{error}</p><button type="button" className="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button></>
      : <PagePlaceholder label="Loading your settings…" />}</main>;
  const save = async (change: SettingsChange) => {
    const updated = await saveSettings(change);
    setSettings(updated);
    share('settings', updated);
    return updated;
  };
  return <main id="content" className="you-page">
    <aside className="you-nav">
      <div className="you-identity">
        <span className="avatar" aria-hidden="true">{initials(settings.username)}</span>
        <div><h1 className="display">You</h1><p className="muted">{settings.username}</p></div>
      </div>
      <div role="tablist" aria-label="Settings sections" className="you-tabs" onKeyDown={arrows}>
        {TABS.map(([key, label]) => <button key={key} ref={(el) => { tabRefs.current[key] = el; }} type="button" role="tab"
          id={`tab-${key}`} aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1}
          className="you-tab" onClick={() => go(key)}>{label}</button>)}
      </div>
    </aside>
    <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="you-panel">
      {tab === 'profile' && <ProfileTab settings={settings} save={save} />}
      {tab === 'settings' && <SettingsTab settings={settings} save={save} />}
      {tab === 'privacy' && <PrivacyTab settings={settings} save={save} />}
      {tab === 'account' && <AccountTab settings={settings} onExportFirst={() => go('privacy')} />}
    </section>
  </main>;
}

type Save = (change: SettingsChange) => Promise<AccountSettings>;

/** Saves a change right away and says so, or says why it couldn't. */
function useSaver(save: Save) {
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const run = async (change: SettingsChange, done = 'Saved') => {
    try { await save(change); setMessage({ tone: 'ok', text: done }); return true; } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError && err.status < 500 ? err.message : "Couldn't save. Try again." });
      return false;
    }
  };
  const view = message && <FormMessage tone={message.tone}>{message.text}</FormMessage>;
  return [run, view] as const;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <section className="you-section" aria-labelledby={id}><h2 id={id} className="section-title">{title}</h2>{children}</section>;
}

function ProfileTab({ settings, save }: { settings: AccountSettings; save: Save }) {
  const [username, setUsername] = useState(settings.username);
  const [run, message] = useSaver(save);
  const [genreRun, genreMessage] = useSaver(save);
  const usernameId = useId();
  const toggle = (genre: string) => {
    const has = settings.favorite_genres.includes(genre);
    genreRun({ favorite_genres: has ? settings.favorite_genres.filter((g) => g !== genre) : [...settings.favorite_genres, genre] });
  };
  return <>
    <Section title="Profile">
      <div className="you-photo"><span className="avatar avatar--large" aria-hidden="true">{initials(settings.username)}</span>
        <p className="muted">Your initials show for now. Photo uploads are coming.</p></div>
      <form className="you-inline-form" onSubmit={(e: FormEvent) => { e.preventDefault(); run({ username }, 'Username saved'); }}>
        <div className="text-field"><label htmlFor={usernameId}>Username</label>
          <input id={usernameId} value={username} autoComplete="username" maxLength={30}
            aria-describedby={`${usernameId}-hint`} onChange={(e) => setUsername(e.target.value)} />
          <p id={`${usernameId}-hint`} className="text-field__hint">3–30 lowercase letters, numbers, _ or -</p></div>
        <button type="submit" className="button button--secondary">Save username</button>
      </form>
      {message}
    </Section>
    <Section title="Favorite genres">
      <div className="genre-pills" role="group" aria-label="Favorite genres">{settings.genres.map((g) =>
        <button key={g} type="button" className="pill" aria-pressed={settings.favorite_genres.includes(g)} onClick={() => toggle(g)}>{g}</button>)}</div>
      {genreMessage}
    </Section>
    <Section title="Connected accounts">
      <div className="you-row"><span><strong>Discogs</strong><span className="muted">Import your collection and wantlist</span></span>
        <Link className="button button--secondary" to="/import">Connect</Link></div>
    </Section>
  </>;
}

function SettingsTab({ settings, save }: { settings: AccountSettings; save: Save }) {
  const { theme, setTheme } = useTheme();
  const [zip, setZip] = useState(settings.home_zip ?? '');
  const [zipError, setZipError] = useState<string | null>(null);
  const [run, message] = useSaver(save);
  const zipId = useId();
  const radius = settings.default_radius_mi as Radius;
  const remember = (z: string | null, r: Radius) => { if (z) saveLocation(z, r); };  // search, nearby and wishlist use it
  return <>
    <Section title="Location">
      <form className="you-inline-form" noValidate onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        if (!isValidZip(zip)) { setZipError('Enter a 5-digit ZIP code'); return; }
        setZipError(null);
        if (await run({ home_zip: zip }, 'Home ZIP saved')) remember(zip, radius);
      }}>
        <div className="text-field"><label htmlFor={zipId}>Home ZIP</label>
          <input id={zipId} inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip}
            aria-invalid={zipError ? true : undefined} aria-describedby={zipError ? `${zipId}-error` : undefined}
            onChange={(e) => setZip(e.target.value)} />
          {zipError && <p id={`${zipId}-error`} role="alert" className="field-error">{zipError}</p>}</div>
        <button type="submit" className="button button--secondary">Save ZIP</button>
      </form>
      <div className="you-field"><span id="radius-label" className="you-field__label">Default radius</span>
        <div className="segmented" role="group" aria-labelledby="radius-label">{RADII.map((r) =>
          <button key={r} type="button" className="segmented__option" aria-pressed={radius === r}
            onClick={async () => { if (await run({ default_radius_mi: r }, 'Radius saved')) remember(settings.home_zip, r); }}>{r} mi</button>)}</div></div>
      <label className="you-toggle"><span><strong>Use current location</strong>
        <span className="muted">Only while the app is open. Off means we use your home ZIP.</span></span>
        <input type="checkbox" checked={settings.use_current_location}
          onChange={(e) => run({ use_current_location: e.target.checked })} /></label>
      {message}
    </Section>
    <Section title="Appearance">
      <div className="segmented" role="group" aria-label="Appearance">{LOOKS.map(([key, label]) =>
        <button key={key} type="button" className="segmented__option" aria-pressed={theme === key}
          onClick={() => { setTheme(key); run({ theme: key }, 'Appearance saved'); }}>{label}</button>)}</div>
    </Section>
  </>;
}

function PrivacyTab({ settings, save }: { settings: AccountSettings; save: Save }) {
  const [run, message] = useSaver(save);
  return <>
    <Section title="Who can see">
      {AREAS.map(([field, label]) => <div key={field} className="you-field">
        <span id={`${field}-label`} className="you-field__label">{label}</span>
        <div className="segmented" role="group" aria-labelledby={`${field}-label`}>{WHO.map(([value, name]) =>
          <button key={value} type="button" className="segmented__option" aria-pressed={settings[field] === value}
            onClick={() => run({ [field]: value }, `${label}: ${name}`)}>{name}</button>)}</div></div>)}
      <p className="muted">Everything starts private. Share when you're ready. Your exact location, what you paid and your collection's value are never shown to anyone.</p>
      {message}
    </Section>
    <Section title="Your data">
      <a className="you-row you-row--link" href="/api/me/export" download><span><strong>Export my collection</strong><span className="muted">CSV file</span></span></a>
      <a className="you-row you-row--link" href="/api/me/data" download><span><strong>Download all my data</strong><span className="muted">Everything we store about you (JSON)</span></span></a>
    </Section>
  </>;
}

function AccountTab({ settings, onExportFirst }: { settings: AccountSettings; onExportFirst: () => void }) {
  const { signOut, setAccount } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const methods = settings.sign_in_methods.map((m) => (m === 'google' ? 'Google' : 'Email and password')).join(' · ') || '—';
  return <>
    <Section title="Sign-in">
      <dl className="you-facts">
        <div><dt>Email</dt><dd>{settings.email}</dd></div>
        <div><dt>Sign-in method</dt><dd>{methods}</dd></div>
      </dl>
      <Link className="you-row you-row--link" to="/forgot-password"><span><strong>Password</strong>
        <span className="muted">{settings.sign_in_methods.includes('password') ? 'Reset it by email' : 'You sign in with Google'}</span></span></Link>
      <button type="button" className="button button--secondary" onClick={() => {
        navigate('/search');
        signOut().catch(() => setError("Couldn't sign out. Try again."));
      }}>Sign out</button>
    </Section>
    <Section title="Policies">
      <Link className="you-row you-row--link" to="/privacy"><span><strong>Privacy Policy</strong>
        <span className="muted">What we store, who helps run the app, your rights</span></span></Link>
      <Link className="you-row you-row--link" to="/terms"><span><strong>Terms of Use</strong>
        <span className="muted">The rules for using Binhopper</span></span></Link>
    </Section>
    <Section title="Delete account">
      {!confirming ? <>
        <p className="muted">Permanently remove your account and everything in it.</p>
        <button type="button" className="button button--danger-outline" onClick={() => setConfirming(true)}>Delete account…</button>
      </> : <div role="alertdialog" aria-labelledby="delete-heading" aria-describedby="delete-text" className="danger-zone">
        <h3 id="delete-heading">Delete your account?</h3>
        <p id="delete-text">This permanently removes your collection, wishlist and settings. Export your collection first if you want to keep it.</p>
        <div className="danger-zone__buttons">
          <button type="button" className="button button--secondary" onClick={onExportFirst}>Export collection first</button>
          <button type="button" className="button button--secondary" autoFocus onClick={() => setConfirming(false)}>Keep account</button>
          <button type="button" className="button button--danger" onClick={async () => {
            try {
              await deleteAccount();
              // Same transition as the navigation, so this signed-in page doesn't bounce to Sign in.
              navigate('/search', { replace: true });
              startTransition(() => setAccount(null));
            } catch { setError("Couldn't delete your account. Try again."); }
          }}>Delete forever</button>
        </div>
      </div>}
    </Section>
    {error && <FormMessage tone="error">{error}</FormMessage>}
  </>;
}
