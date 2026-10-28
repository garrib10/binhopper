import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { fetchCopy, removeCopy, updateCopy, type CopyDetail } from '../collection';
import { Cover } from '../components/AlbumTile';
import { CopyForm } from '../components/CopyForm';

/** One copy you own (mockup Owned.dc.html): pressing, grades, price paid, where bought, notes. */
export function OwnedPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [copy, setCopy] = useState<CopyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchCopy(Number(id), controller.signal).then(setCopy).catch((err) => {
      if (!controller.signal.aborted) setError(err instanceof ApiError && err.status === 404 ? 'That copy isn’t in your collection.' : "Can't reach Binhopper right now.");
    });
    return () => controller.abort();
  }, [id]);

  if (!copy) return <main id="content" className="page"><h1 className="display">Your copy</h1>
    {error ? <p role="alert">{error} <Link to="/collection">Back to collection</Link></p> : <p role="status">Loading…</p>}</main>;
  return <main id="content" className="page copy-page">
    <Link className="back-link" to="/collection">← Collection</Link>
    <header className="copy-header">
      <div className="copy-header__cover"><Cover url={copy.album.cover_url} title={copy.album.title} /></div>
      <div><h1 className="display">{copy.album.title}</h1>
        <p><Link to={`/albums/${copy.album.id}`}>{copy.album.artist.name}</Link></p>
        <p className="tag tag--ok">In your collection{copy.copy_number > 1 ? ` · copy ${copy.copy_number}` : ''}</p></div>
    </header>
    <CopyForm pressings={copy.pressings} initialPressing={copy.pressing.id} initial={copy} submitLabel="Save my copy" busy={busy}
      onSubmit={async (pressingId, details) => {
        setBusy(true); setError(null);
        try { await updateCopy(copy.id, pressingId, details); navigate('/collection'); } catch (err) {
          setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't save. Try again.");
        } finally { setBusy(false); }
      }}>
      {error && <p role="alert" className="notice notice--danger">{error}</p>}
    </CopyForm>
    <section className="copy-remove" aria-label="Remove this copy">
      {confirming ? <><p>Remove this copy of {copy.album.title} from your collection?</p>
        <div className="copy-remove__buttons">
          <button type="button" className="button button--danger" onClick={async () => {
            try { await removeCopy(copy.id); navigate('/collection'); } catch { setError("Couldn't remove it. Try again."); }
          }}>Remove copy</button>
          <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>Keep it</button>
        </div></>
        : <button type="button" className="text-button" onClick={() => setConfirming(true)}>Remove from collection</button>}
    </section>
  </main>;
}
