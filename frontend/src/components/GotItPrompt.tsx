import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../AuthContext';
import { AlreadyOwned, ordinal } from '../collection';
import { forgetHandoff, gotIt, type Handoff } from '../handoff';
import { useWishlist } from '../WishlistContext';

type State = { kind: 'ask' } | { kind: 'duplicate'; copies: number } | { kind: 'added'; copyId: number; leftWishlist: boolean };

/** "Got it? Add to collection" after a hand-off to the shop (SPEC › Locate, hold, buy rule 3). */
export function GotItPrompt({ handoff, onDone, onAdded }: { handoff: Handoff; onDone?: () => void; onAdded?: () => void }) {
  const { state: auth } = useAuth();
  const { forget } = useWishlist();
  const location = useLocation();
  const [state, setState] = useState<State>({ kind: 'ask' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(anotherCopy = false) {
    setBusy(true); setError(null);
    try {
      const copy = await gotIt(handoff.listingId, anotherCopy);
      forgetHandoff(handoff.listingId);
      forget(handoff.albumId);  // the heart empties: it left the wishlist
      setState({ kind: 'added', copyId: copy.id, leftWishlist: copy.removed_from_wishlist });
      onAdded?.();
    } catch (err) {
      if (err instanceof AlreadyOwned) setState({ kind: 'duplicate', copies: err.copies });
      else setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't add it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === 'added') return <section className="got-it got-it--done" aria-live="polite">
    <h2 className="got-it__title">Added to your collection</h2>
    <p>{handoff.albumTitle}{state.leftWishlist ? ' moved off your wishlist.' : ' is in your collection.'} Add the condition and notes anytime.</p>
    <div className="got-it__buttons">
      <Link className="button button--primary" to={`/collection/${state.copyId}`}>Add details</Link>
      <Link className="button button--secondary" to="/collection">View collection</Link>
    </div>
  </section>;
  return <section className="got-it" aria-labelledby={`got-it-${handoff.listingId}`}>
    <h2 className="got-it__title" id={`got-it-${handoff.listingId}`}>Got {handoff.albumTitle}?</h2>
    <p>You contacted {handoff.storeName}. If it's yours now, add it to your collection.</p>
    {state.kind === 'duplicate' && <p className="notice notice--warn" role="alert">
      <strong>You already own this pressing</strong> ({state.copies} {state.copies === 1 ? 'copy' : 'copies'}).</p>}
    {error && <p role="alert" className="notice notice--danger">{error}</p>}
    <div className="got-it__buttons">
      {auth.status !== 'signed-in'
        ? <Link className="button button--primary" to={`/sign-in?return_to=${encodeURIComponent(location.pathname)}`}>Sign in to add it to your collection</Link>
        : state.kind === 'duplicate'
          ? <button type="button" className="button button--primary" disabled={busy} onClick={() => add(true)}>Add as {ordinal(state.copies + 1)} copy</button>
          : <button type="button" className="button button--primary" disabled={busy} onClick={() => add()}>It's on my shelf, add to collection</button>}
      <button type="button" className="button button--secondary" onClick={() => { forgetHandoff(handoff.listingId); onDone?.(); }}>No thanks</button>
    </div>
  </section>;
}
