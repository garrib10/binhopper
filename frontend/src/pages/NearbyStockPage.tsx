import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, fetchNearbyStock, isValidZip, RADII, type NearbyStockResponse, type Radius } from '../api';
import { RadiusPicker } from '../components/RadiusPicker';
import { StoreCard } from '../components/StoreCard';

interface Props {
  albumId: number;
  albumTitle: string;
  artistName: string;
  initialZip?: string;
  initialRadius?: Radius;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; data: NearbyStockResponse };

/** Nearby stock (SPEC.md › Nearby stock; mockups Stores.dc.html + Desktop.dc.html). */
export function NearbyStockPage({ albumId, albumTitle, artistName, initialZip = '10011', initialRadius = 25 }: Props) {
  const [zipInput, setZipInput] = useState(initialZip);
  const [zip, setZip] = useState(initialZip);
  const [zipError, setZipError] = useState<string | null>(null);
  const [radius, setRadius] = useState<Radius>(initialRadius);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchNearbyStock(albumId, zip, radius, controller.signal)
      .then((data) => setState({ kind: 'loaded', data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof ApiError ? err.message : 'Could not load stores. Try again.';
        setState({ kind: 'error', message });
      });
    return () => controller.abort();
  }, [albumId, zip, radius]);

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
    <main className="page">
      <header className="page__header">
        <p className="eyebrow">Looking for</p>
        <h1 className="display">{albumTitle}</h1>
        <p className="muted">{artistName}</p>
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

      <section aria-live="polite" aria-busy={state.kind === 'loading'}>
        {state.kind === 'loading' && <p className="muted">Finding shops…</p>}

        {state.kind === 'error' && (
          <p role="alert" className="notice notice--danger">
            {state.message}
          </p>
        )}

        {state.kind === 'loaded' && state.data.stores.length > 0 && (
          <>
            <h2 className="section-title">
              {state.data.stores.length} {state.data.stores.length === 1 ? 'store has it' : 'stores have it'}
            </h2>
            <ol className="store-list">
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
            {nextRadius && (
              <button type="button" className="button button--primary" onClick={() => setRadius(nextRadius)}>
                Try {nextRadius} mi
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
