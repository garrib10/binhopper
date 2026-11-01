import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { fetchCopy, removeCopy, updateCopy, type CopyDetail } from '../collection';
import { Cover } from '../components/AlbumTile';
import { CopyForm } from '../components/CopyForm';
import { describeLoadError, LoadError, type LoadProblem } from '../components/LoadError';
import { usePageData } from '../pageData';
import { useWishlist } from '../WishlistContext';
import { PagePlaceholder } from '../components/PagePlaceholder';

/** One copy you own (mockup Owned.dc.html): pressing, grades, price paid, where bought, notes. */
export function OwnedPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { forget } = useWishlist();
  // Set by "Add to collection": say what happened, including the wishlist (rule 6).
  const justAdded = useLocation().state as { added?: boolean; leftWishlist?: boolean; stillWanted?: boolean } | null;
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Fetched early from Collection (or handed over by "Add to collection"), so it draws at once.
  const { data: copy, error: failed } = usePageData<CopyDetail>(`copy:${id}`, () => fetchCopy(Number(id)), attempt);
  const loadProblem: LoadProblem | null = failed ? describeLoadError(failed, 'That copy isn’t in your collection.') : null;
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!copy) return <main id="content" className="page"><h1 className="display">Your copy</h1>
    {loadProblem ? <LoadError problem={loadProblem} onRetry={() => setAttempt((n) => n + 1)} back={{ to: '/collection', label: 'Back to collection' }} />
      : <PagePlaceholder label="Loading your copy…" />}</main>;
  return <main id="content" className="page copy-page">
    <Link className="back-link" to="/collection">← Collection</Link>
    <header className="copy-header">
      <div className="copy-header__cover"><Cover url={copy.album.cover_url} title={copy.album.title} /></div>
      <div><h1 className="display">{copy.album.title}</h1>
        <p><Link to={`/albums/${copy.album.id}`}>{copy.album.artist.name}</Link></p>
        <p className="tag tag--ok">In your collection{copy.copy_number > 1 ? ` · copy ${copy.copy_number}` : ''}</p></div>
    </header>
    {justAdded?.added && <p className="notice notice--ok" role="status">
      Added to your collection.
      {justAdded.leftWishlist && ` ${copy.album.title} moved off your wishlist.`}
      {justAdded.stillWanted && ' It stays on your wishlist for the other pressing you want.'}
      {!copy.media_grade && !copy.sleeve_grade && ' Add the media and sleeve condition anytime below.'}
    </p>}
    <CopyForm pressings={copy.pressings} initialPressing={copy.pressing.id} initial={copy} submitLabel="Save my copy" busy={busy}
      onSubmit={async (pressingId, details) => {
        setBusy(true); setError(null);
        try {
          const saved = await updateCopy(copy.id, pressingId, details);
          if (saved.removed_from_wishlist && !saved.album_on_wishlist) forget(copy.album.id);  // rule 6, like adding
          navigate('/collection');
        } catch (err) {
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
