import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, isValidZip, RADII, type Radius } from '../api';
import { fetchSettings, saveSettings, type SettingsChange } from '../account';
import { safeReturnTo } from '../auth';
import { loadLocation, saveLocation } from '../location';
import '../styles/onboarding.css';

const RADIUS_NOTES: Record<Radius, string> = { 10: 'Neighborhood', 25: 'Across town', 50: 'Day trip', 100: 'Road trip' };
const STEPS = 4;

/** The ZIP nearest a device location; the coordinates are used once and never stored. */
async function nearestZip(lat: number, lng: number): Promise<string> {
  const response = await fetch(`/api/zips/nearest?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body.detail ?? "We couldn't find your ZIP. Enter it instead.");
  return body.zip;
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unavailable')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 600_000, timeout: 15_000 });
  });
}

/** Onboarding (SPEC.md › Onboarding; mockups Onboarding.dc.html, LocationDenied.dc.html). */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const done = safeReturnTo(params.get('return_to'));
  const zipId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [zip, setZip] = useState(loadLocation().zip);
  const [radius, setRadius] = useState<Radius>(25);
  const [genres, setGenres] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [locationOff, setLocationOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    fetchSettings().then((s) => {
      if (s.home_zip) setZip(s.home_zip);
      setRadius(s.default_radius_mi);
      setGenres(s.favorite_genres);
      setAllGenres(s.genres);
    }).catch(() => setError("Can't reach Binhopper right now."));
  }, []);
  useEffect(() => {  // move focus to each new step's question for keyboard and screen reader users
    if (first.current) { first.current = false; return; }
    heading.current?.focus();
  }, [step]);

  async function save(change: SettingsChange): Promise<boolean> {
    setBusy(true); setError(null);
    try { await saveSettings(change); return true; } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't save. Try again.");
      return false;
    } finally { setBusy(false); }
  }

  async function next(event?: FormEvent) {
    event?.preventDefault();
    if (step === 0) {
      if (!isValidZip(zip)) { setError('Enter a 5-digit ZIP code'); return; }
      if (!(await save({ home_zip: zip }))) return;
      saveLocation(zip, radius);
    } else if (step === 1) {
      if (!(await save({ default_radius_mi: radius }))) return;
      saveLocation(zip, radius);
    } else if (step === 2) {
      if (!(await save({ favorite_genres: genres }))) return;
    }
    setStep(step + 1);
  }

  async function useMyLocation() {
    setError(null); setBusy(true);
    try {
      const position = await currentPosition();
      const found = await nearestZip(position.coords.latitude, position.coords.longitude);
      setZip(found);
      setLocationOff(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setLocationOff(true);  // denied or unavailable: the ZIP works just as well
    } finally { setBusy(false); }
  }

  const QUESTIONS = ['Where do you dig?', 'How far will you go?', 'What do you spin?', 'Got records already?'];
  return <main id="content" className="onboarding">
    <p className="onboarding__step">Step {step + 1} of {STEPS}</p>
    <div className="onboarding__bars" aria-hidden="true">{Array.from({ length: STEPS }, (_, i) =>
      <span key={i} data-done={i <= step} />)}</div>
    <form className="onboarding__body" onSubmit={next} noValidate>
      <h1 className="display" ref={heading} tabIndex={-1}>{QUESTIONS[step]}</h1>
      {step === 0 && <>
        <p className="muted">We use your location only to find record shops near you. You can change it anytime.</p>
        <button type="button" className="button button--primary button--block" disabled={busy} onClick={useMyLocation}>Use my location</button>
        {locationOff && <div className="notice notice--warn" role="status">
          <strong>Location is off.</strong> No problem: a ZIP code works just as well, and we never track where you go.</div>}
        <p className="auth-divider"><span>or</span></p>
        <div className="text-field"><label htmlFor={zipId}>Enter a ZIP code</label>
          <input id={zipId} inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value)} /></div>
      </>}
      {step === 1 && <>
        <p className="muted">Your default search radius. You can change it on any search.</p>
        <div className="onboarding__radii" role="group" aria-label="Default radius">{RADII.map((r) =>
          <button key={r} type="button" className="onboarding__radius" aria-pressed={radius === r} onClick={() => setRadius(r)}>
            <strong>{r} mi</strong><span>{RADIUS_NOTES[r]}</span></button>)}</div>
      </>}
      {step === 2 && <>
        <p className="muted">Pick a few genres, or none. You can change them in You › Profile.</p>
        <div className="genre-pills" role="group" aria-label="Favorite genres">{allGenres.map((g) =>
          <button key={g} type="button" className="pill" aria-pressed={genres.includes(g)}
            onClick={() => setGenres(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g])}>{g}</button>)}</div>
      </>}
      {step === 3 && <>
        <p className="muted">Bring your Discogs collection and wantlist to get started.</p>
        <Link className="you-row you-row--link" to="/import"><span><strong>Import from Discogs</strong><span className="muted">Collection and wantlist</span></span></Link>
      </>}
      {error && <p role="alert" className="notice notice--danger">{error}</p>}
      <div className="onboarding__nav">
        {step > 0 && <button type="button" className="button button--secondary" onClick={() => { setError(null); setStep(step - 1); }}>Back</button>}
        {step < STEPS - 1 ? <button type="submit" className="button button--primary" disabled={busy}>Continue</button>
          : <button type="button" className="button button--primary" onClick={() => navigate(done, { replace: true })}>Skip for now</button>}
      </div>
    </form>
  </main>;
}
