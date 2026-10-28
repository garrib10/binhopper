import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, fetchNearbyStock, isValidZip, RADII, type NearbyStockResponse, type Radius } from '../api';
import { RadiusPicker } from '../components/RadiusPicker';
import { OtherShopCard, StoreCard } from '../components/StoreCard';
import { StockMap } from '../components/StockMap';
import { OnlineSellers, type OnlineResult } from '../components/OnlineSellers';
import { getCatalog } from '../catalog';

interface Props {
  albumId: number;
  albumTitle: string;
  artistName: string;
  initialZip?: string;
  initialRadius?: Radius;
  onLocationChange?: (zip: string, radius: Radius) => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'loaded'; data: NearbyStockResponse };

const UNKNOWN_ZIP = "We don't have that ZIP yet. Check it or try a nearby one.";
const UNREACHABLE = "Can't reach Binhopper right now.";

/** Turn a failed request into what the user sees. Network failures and 5xx can be retried. */
function describeError(err: unknown): { message: string; canRetry: boolean } {
  if (!(err instanceof ApiError) || err.status >= 500) return { message: UNREACHABLE, canRetry: true };
  if (err.status === 404 && err.message === 'Unknown ZIP code') return { message: UNKNOWN_ZIP, canRetry: false };
  return { message: err.message, canRetry: false };
}

/** Nearby stock (SPEC.md › Nearby stock; mockups Stores.dc.html + Desktop.dc.html). */
export function NearbyStockPage({ albumId, albumTitle, artistName, initialZip = '10011', initialRadius = 25, onLocationChange }: Props) {
  const [zipInput, setZipInput] = useState(initialZip);
  const [zip, setZip] = useState(initialZip);
  const [zipError, setZipError] = useState<string | null>(null);
  const [radius, setRadius] = useState<Radius>(initialRadius);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [online, setOnline] = useState<OnlineResult | null>(null);
  const [onlineError, setOnlineError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setOnline(null); setOnlineError(false);
    getCatalog<OnlineResult>(`/albums/${albumId}/online`, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setOnline(data); })
      .catch(() => { if (!controller.signal.aborted) setOnlineError(true); });
    return () => controller.abort();
  }, [albumId, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchNearbyStock(albumId, zip, radius, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ kind: 'loaded', data }); })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', ...describeError(err) });
      });
    return () => controller.abort();
  }, [albumId, zip, radius, attempt]);

  useEffect(() => { onLocationChange?.(zip, radius); }, [zip, radius, onLocationChange]);

  function submitZip(event: FormEvent) {
    event.preventDefault();
    if (!isValidZip(zipInput)) {
      setZipError('Enter a 5-digit ZIP code');
      return;
    }
    setZipError(null);
    setZip(zipInput);
  }

  const nextRadius = RADII.find((r) => r > radius);

  return (
    <main id="content" className="page nearby-page">
      <header className="page__header">
        <p className="eyebrow">Looking for</p>
        <h1 className="display">{online?.album_title ?? albumTitle}</h1>
        <p className="muted">{online?.artist_name ?? artistName}</p>
      </header>

      <div className="controls">
        <form className="zip-field" onSubmit={submitZip} noValidate>
          <label htmlFor="zip">ZIP code</label>
          <input
            id="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zipInput}
            aria-invalid={zipError ? true : undefined}
            aria-describedby={zipError ? 'zip-error' : undefined}
            onChange={(e) => setZipInput(e.target.value)}
          />
          {zipError && (
            <p id="zip-error" role="alert" className="field-error">
              {zipError}
            </p>
          )}
        </form>
        <RadiusPicker value={radius} onChange={setRadius} />
      </div>

      <div className="nearby-layout">
      {state.kind === 'loaded' && <StockMap data={state.data} />}
      <section aria-live="polite" aria-busy={state.kind === 'loading'}>
        {state.kind === 'loading' && <p className="muted">Finding shops…</p>}

        {state.kind === 'error' && (
          <div className="error-state">
            <p role="alert" className="notice notice--danger">
              {state.message}
            </p>
            {state.canRetry && (
              <button type="button" className="button button--primary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            )}
          </div>
        )}

        {state.kind === 'loaded' && state.data.stores.length > 0 && (
          <>
            <h2 className="section-title" id="stock-heading">
              {state.data.stores.length} {state.data.stores.length === 1 ? 'store has it' : 'stores have it'}
            </h2>
            <ol className="store-list" aria-labelledby="stock-heading">
              {state.data.stores.map((s, i) => (
                <StoreCard key={s.listing_id} store={s} index={i} />
              ))}
            </ol>
          </>
        )}

        {state.kind === 'loaded' && state.data.stores.length === 0 && (
          <div className="empty">
            <h2 className="section-title">Nothing within {radius} mi</h2>
            {state.data.nearest_outside_mi !== null && (
              <p className="muted">Nearest copy is {state.data.nearest_outside_mi} mi away.</p>
            )}
            <p>No shop in this radius has this album right now.</p>
            {nextRadius && (
              <button type="button" className="button button--primary" onClick={() => setRadius(nextRadius)}>
                Try {nextRadius} mi
              </button>
            )}
            {online?.sellers?.length ? <a href="#online-sellers">See online sellers instead</a> : null}
          </div>
        )}
        {state.kind === 'loaded' && state.data.other_shops?.length ? (
          <section className="other-shops" aria-labelledby="other-shops-heading">
            <h2 className="section-title" id="other-shops-heading">Other record shops nearby</h2>
            <p className="muted">No online inventory. Call to check.</p>
            <ul className="store-list" aria-labelledby="other-shops-heading">
              {state.data.other_shops.map((shop) => <OtherShopCard key={shop.store_id} shop={shop} albumId={albumId} />)}
            </ul>
          </section>
        ) : null}
        <OnlineSellers data={online} />
        {onlineError && <p className="muted">Online sellers are unavailable right now.</p>}
      </section>
      </div>
    </main>
  );
}
