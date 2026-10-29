import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { type AlbumDetail, getCatalog } from '../catalog';
import { addCopy, AlreadyOwned, ordinal, type CopyDetails } from '../collection';
import { Cover } from '../components/AlbumTile';
import { CopyForm } from '../components/CopyForm';
import { useWishlist } from '../WishlistContext';
import { describeLoadError, LoadError, type LoadProblem } from '../components/LoadError';

/** Add a copy of an album (SPEC.md › Collection rules 1–3). */
export function AddCopyPage() {
  const { albumId = '' } = useParams();
  const navigate = useNavigate();
  const { forget } = useWishlist();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadProblem, setLoadProblem] = useState<LoadProblem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [duplicate, setDuplicate] = useState<{ copies: number; pressingId: number; details: CopyDetails } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getCatalog<AlbumDetail>(`/albums/${albumId}`, controller.signal).then(setAlbum).catch((err) => {
      if (!controller.signal.aborted) setLoadProblem(describeLoadError(err, "That album isn't in Binhopper."));
    });
    return () => controller.abort();
  }, [albumId, attempt]);

  async function save(pressingId: number, details: CopyDetails, anotherCopy = false) {
    setBusy(true); setError(null);
    try {
      const copy = await addCopy(pressingId, details, anotherCopy);
      if (!copy.album_on_wishlist) forget(Number(albumId));  // keep the hearts in step (rule 6)
      navigate(`/collection/${copy.id}`, { replace: true, state: {
        added: true, leftWishlist: copy.removed_from_wishlist, stillWanted: copy.album_on_wishlist } });
    } catch (err) {
      if (err instanceof AlreadyOwned) setDuplicate({ copies: err.copies, pressingId, details });
      else setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!album) return <main id="content" className="page"><h1 className="display">Add to collection</h1>
    {loadProblem ? <LoadError problem={loadProblem} onRetry={() => { setLoadProblem(null); setAttempt((n) => n + 1); }} back={{ to: '/search', label: 'Back to search' }} />
      : <p role="status">Loading…</p>}</main>;
  return <main id="content" className="page copy-page">
    <Link className="back-link" to={`/albums/${album.id}`}>← {album.title}</Link>
    <header className="copy-header">
      <div className="copy-header__cover"><Cover url={album.cover_url} title={album.title} /></div>
      <div><h1 className="display">Add to collection</h1><p>{album.title} · {album.artist.name}</p></div>
    </header>
    <CopyForm submitLabel="Add to collection" busy={busy} initialPressing={null}
      pressings={album.pressings.map((p) => ({ id: p.id, note: p.variant_note ?? p.format, detail: [p.label, p.format].filter(Boolean).join(' · ') }))}
      onSubmit={(pressingId, details) => { setDuplicate(null); save(pressingId, details); }}>
      {duplicate && <div className="notice notice--warn duplicate-warning" role="alert">
        <p><strong>You already own this pressing</strong> ({duplicate.copies} {duplicate.copies === 1 ? 'copy' : 'copies'}).</p>
        <button type="button" className="button button--primary" disabled={busy}
          onClick={() => save(duplicate.pressingId, duplicate.details, true)}>Add as {ordinal(duplicate.copies + 1)} copy</button>
      </div>}
      {error && <p role="alert" className="notice notice--danger">{error}</p>}
    </CopyForm>
  </main>;
}
