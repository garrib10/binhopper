import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useWishlist } from '../WishlistContext';

function Heart({ filled }: { filled: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
    strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>;
}

/**
 * The wishlist heart (mockups Main, Album, DesktopAlbum). Signed out, it's a link to sign in:
 * only signed-in users have a wishlist, so nothing is saved until then.
 */
export function HeartButton({ albumId, title, labelled = false }: { albumId: number; title: string; labelled?: boolean }) {
  const { state } = useAuth();
  const { has, toggle } = useWishlist();
  const location = useLocation();
  const [error, setError] = useState(false);
  const className = `heart-button${labelled ? ' heart-button--labelled' : ''}`;
  if (state.status !== 'signed-in') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Link className={className} to={`/sign-in?return_to=${returnTo}`}
      aria-label={labelled ? undefined : `Sign in to save ${title} to your wishlist`}>
      <Heart filled={false} />{labelled && 'Sign in to save'}</Link>;
  }
  const on = has(albumId);
  return <>
    <button type="button" className={className} aria-pressed={on}
      aria-label={labelled ? undefined : on ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
      onClick={() => { setError(false); toggle(albumId).catch(() => setError(true)); }}>
      <Heart filled={on} />{labelled && (on ? 'On wishlist' : 'Add to wishlist')}
    </button>
    {error && <span role="alert" className="field-error">Couldn't update your wishlist. Try again.</span>}
  </>;
}
