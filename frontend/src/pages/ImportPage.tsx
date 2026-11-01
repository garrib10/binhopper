import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { describeLoadError, LoadError, type LoadProblem } from '../components/LoadError';
import { disconnectDiscogs, fetchImportStatus, isActive, startImport, type ImportStatus } from '../discogsImport';
import '../styles/import.css';

const POLL_MS = 3000;

/** Import from Discogs (SPEC.md › Discogs import; mockup Import.dc.html). */
export function ImportPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [collection, setCollection] = useState(true);
  const [wantlist, setWantlist] = useState(true);
  const [error, setError] = useState<string | null>(params.get('error') === 'discogs' ? "Connecting to Discogs didn't finish. Try again." : null);
  const [busy, setBusy] = useState(false);
  const [loadProblem, setLoadProblem] = useState<LoadProblem | null>(null);
  const load = useCallback(() => fetchImportStatus().then((s) => { setStatus(s); setLoadProblem(null); })
    .catch((err) => setLoadProblem(describeLoadError(err, 'Import is unavailable.'))), []);
  useEffect(() => { load(); }, [load]);
  const running = isActive(status?.job ?? null);
  useEffect(() => {  // the worker runs the import; check on it while it's going
    if (!running) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [running, load]);

  async function begin() {
    if (!collection && !wantlist) { setError('Choose your collection, your wantlist or both'); return; }
    setBusy(true); setError(null);
    try { await startImport(collection, wantlist); await load(); } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't start the import. Try again.");
    } finally { setBusy(false); }
  }

  const job = status?.job ?? null;
  return <main id="content" className="page import-page">
    <Link className="back-link" to="/collection">← Collection</Link>
    <header><h1 className="display">Bring your records</h1>
      <p className="muted">Already catalog on Discogs? Import your collection and wantlist so you don't start from zero.</p></header>
    {error && <p role="alert" className="notice notice--danger">{error}</p>}
    {!status && loadProblem ? <LoadError problem={loadProblem} onRetry={load} back={{ to: '/collection', label: 'Back to collection' }} />
      : !status ? <p role="status">Loading…</p>
      : !status.configured ? <p className="notice notice--warn">Discogs import isn't set up on this server yet.</p>
      : !status.connected ? <section className="import-card">
        <p>Connect your Discogs account. Discogs asks you to approve read access, then sends you back here.</p>
        <a className="button button--primary button--block" href="/api/discogs/connect">Connect Discogs</a>
        <p className="muted">We store the connection encrypted and remove it when you disconnect.</p>
      </section>
      : <>
        <section className="import-card" aria-label="Discogs connection">
          <p>Connected to Discogs as <strong>{status.username}</strong></p>
          <button type="button" className="text-button" disabled={running} onClick={async () => {
            try { await disconnectDiscogs(); await load(); } catch { setError("Couldn't disconnect. Try again."); }
          }}>Disconnect</button>
        </section>
        {running && job ? <section className="import-card" role="status" aria-live="polite">
          <h2 className="section-title">Importing…</h2>
          <p>{job.added} added to your collection · {job.wishlisted} to your wishlist · {job.skipped} skipped
            {job.looking_up ? ` · ${job.looking_up} being looked up` : ''}</p>
          <p className="muted">You can leave this page; the import keeps going.</p>
        </section> : <>
          {job?.status === 'done' && <section className="import-card import-summary" aria-labelledby="import-done">
            <h2 id="import-done" className="section-title">Import complete</h2>
            <dl className="import-counts">
              <div><dt>Added to collection</dt><dd>{job.added}</dd></div>
              <div><dt>Added to wishlist</dt><dd>{job.wishlisted}</dd></div>
              <div><dt>Duplicates skipped</dt><dd>{job.skipped}</dd></div>
            </dl>
            {job.not_found > 0 && <p className="muted">{job.not_found} {job.not_found === 1 ? 'release isn’t' : 'releases aren’t'} in our catalog yet, so {job.not_found === 1 ? 'it was' : 'they were'} left out.</p>}
            <div className="import-links">
              <Link className="button button--primary" to="/collection">Go to my collection</Link>
              <Link className="button button--secondary" to="/wishlist">See my wishlist</Link>
            </div>
          </section>}
          {job?.status === 'failed' && <p role="alert" className="notice notice--danger">The last import stopped: {job.error ?? 'something went wrong'}.</p>}
          <fieldset className="import-card import-choices">
            <legend className="section-title">What to import</legend>
            <label><input type="checkbox" checked={collection} onChange={(e) => setCollection(e.target.checked)} />
              <span><strong>Collection</strong><span className="muted">Which pressings you own. Add their condition here afterwards</span></span></label>
            <label><input type="checkbox" checked={wantlist} onChange={(e) => setWantlist(e.target.checked)} />
              <span><strong>Wantlist → Wishlist</strong><span className="muted">We'll check nearby stock right away</span></span></label>
            <p className="muted">Records already in your Binhopper collection are matched by pressing and skipped, so nothing gets doubled.</p>
            <button type="button" className="button button--primary button--block" disabled={busy} onClick={begin}>
              {job ? 'Import again' : 'Import'}</button>
          </fieldset>
        </>}
      </>}
  </main>;
}
