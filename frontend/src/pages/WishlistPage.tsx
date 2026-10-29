import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api';
import { Cover } from '../components/AlbumTile';
import { loadLocation } from '../location';
import { useWishlist } from '../WishlistContext';
import { GotItPrompt } from '../components/GotItPrompt';
import { pendingHandoffs } from '../handoff';
import '../styles/handoff.css';
import {
  fetchWishlist, GRADES, removeWishlistItem, updateWishlistItem, wantText,
  type Grade, type WishlistItem,
} from '../wishlist';

const money = (value: number) => `$${value % 1 ? value.toFixed(2) : value}`;

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; items: WishlistItem[] };

/** Wishlist (SPEC.md › Wishlist; mockup Wishlist.dc.html). */
export function WishlistPage() {
  const [location] = useState(loadLocation);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Hand-offs still waiting for "Got it?" (up to 7 days; SPEC › Locate, hold, buy rule 3).
  const [handoffs, setHandoffs] = useState(pendingHandoffs);
  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchWishlist(location.zip, location.radius, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ kind: 'loaded', items: data.items }); })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'error' }); });
    return () => controller.abort();
  }, [location, attempt]);

  const reload = () => setAttempt((n) => n + 1);
  const count = state.kind === 'loaded' ? state.items.length : null;
  return <main id="content" className="page wishlist-page">
    <header className="wishlist-header">
      <h1 className="display">Wishlist</h1>
      {count !== null && <span className="muted">{count} {count === 1 ? 'record' : 'records'}</span>}
    </header>
    <p className="muted">Stock within {location.radius} mi of {location.zip} · <Link to="/albums/1/stores">Change location</Link></p>
    {handoffs.length > 0 && <div className="wishlist-got-it">{handoffs.map((h) =>
      <GotItPrompt key={h.listingId} handoff={h} onAdded={reload} onDone={() => setHandoffs(pendingHandoffs())} />)}</div>}
    {state.kind === 'loading' && <p role="status">Loading your wishlist…</p>}
    {state.kind === 'error' && <div className="error-state">
      <p role="alert" className="notice notice--danger">Can't reach Binhopper right now.</p>
      <button type="button" className="button button--primary" onClick={reload}>Try again</button>
    </div>}
    {state.kind === 'loaded' && (state.items.length === 0
      ? <div className="empty">
        <h2 className="section-title">Nothing on your wishlist yet</h2>
        <p>Tap the heart on any record to save it here. We'll show which shops near you have it.</p>
      </div>
      : <ul className="wishlist-items">{state.items.map((item) =>
        <WishlistCard key={item.id} item={item} radius={location.radius} onChange={reload} />)}</ul>)}
    {state.kind === 'loaded' && <Link className="wishlist-add" to="/search">Add a record to your wishlist</Link>}
  </main>;
}

function WishlistCard({ item, radius, onChange }: { item: WishlistItem; radius: number; onChange: () => void }) {
  const { forget } = useWishlist();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { album } = item;
  async function remove() {
    try {
      await removeWishlistItem(item.id);
      forget(album.id);
      onChange();
    } catch {
      setError("Couldn't remove it. Try again.");
    }
  }
  const alsoCheapest = item.cheapest && item.nearest && item.cheapest.store_name !== item.nearest.store_name;
  return <li className="wishlist-card">
    <div className="wishlist-card__row">
      <div className="wishlist-card__cover"><Cover url={album.cover_url} title={album.title} /></div>
      <div className="wishlist-card__info">
        <h2 className="wishlist-card__title"><Link to={`/albums/${album.id}`}>{album.title}</Link></h2>
        <p className="muted">{album.artist.name}</p>
        <p className="wishlist-card__want">Wants: {wantText(item)}</p>
      </div>
    </div>
    <div className="wishlist-card__stock">
      {item.store_count > 0 && item.nearest ? <>
        <div className="wishlist-card__stock-text">
          <p className="wishlist-card__in-stock">{item.store_count} {item.store_count === 1 ? 'store' : 'stores'} in range</p>
          <p className="muted">Nearest: {item.nearest.store_name} · {item.nearest.distance_mi} mi · {money(item.nearest.price)}</p>
          {alsoCheapest && item.cheapest && <p className="muted">Cheapest: {item.cheapest.store_name} · {item.cheapest.distance_mi} mi · {money(item.cheapest.price)}</p>}
        </div>
        <Link className="button button--primary" to={`/albums/${album.id}/stores`} aria-label={`Find it: ${album.title}`}>Find it</Link>
      </> : <div className="wishlist-card__stock-text">
        <p><strong>None within {radius} mi</strong></p>
        <p className="muted">{item.nearest_outside_mi !== null ? `Closest copy is ${item.nearest_outside_mi} mi away` : 'Not in stock nearby'}</p>
      </div>}
    </div>
    <div className="wishlist-card__actions">
      <button type="button" className="text-button" aria-expanded={editing} onClick={() => setEditing(!editing)}>
        {editing ? 'Close' : 'Change what you want'}</button>
      <button type="button" className="text-button" onClick={remove} aria-label={`Remove ${album.title} from wishlist`}>Remove</button>
    </div>
    {editing && <TargetForm item={item} onSaved={() => { setEditing(false); onChange(); }} />}
    {error && <p role="alert" className="field-error">{error}</p>}
  </li>;
}

/** Wishlist rule 2: any or one pressing, an optional price cap and minimum condition. */
function TargetForm({ item, onSaved }: { item: WishlistItem; onSaved: () => void }) {
  const id = useId();
  const [pressing, setPressing] = useState(item.pressing_id === null ? '' : String(item.pressing_id));
  const [maxPrice, setMaxPrice] = useState(item.max_price === null ? '' : String(item.max_price));
  const [grade, setGrade] = useState<Grade | ''>(item.min_condition ?? '');
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const price = maxPrice.trim() === '' ? null : Number(maxPrice);
    if (price !== null && !(price > 0)) { setError('Enter a price above $0, or leave it empty'); return; }
    try {
      await updateWishlistItem(item.id, { pressing_id: pressing ? Number(pressing) : null, max_price: price, min_condition: grade || null });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't save. Try again.");
    }
  }
  return <form className="wishlist-form" onSubmit={submit}>
    <div className="text-field"><label htmlFor={`${id}-pressing`}>Pressing</label>
      <select id={`${id}-pressing`} value={pressing} onChange={(e) => setPressing(e.target.value)}>
        <option value="">Any pressing</option>
        {item.pressings.map((p) => <option key={p.id} value={p.id}>{p.note ?? `Pressing ${p.id}`}</option>)}
      </select></div>
    <div className="text-field"><label htmlFor={`${id}-price`}>Max price ($)</label>
      <input id={`${id}-price`} inputMode="decimal" value={maxPrice} placeholder="No limit" onChange={(e) => setMaxPrice(e.target.value)} /></div>
    <div className="text-field"><label htmlFor={`${id}-grade`}>Minimum condition</label>
      <select id={`${id}-grade`} value={grade} onChange={(e) => setGrade(e.target.value as Grade | '')}>
        <option value="">Any condition</option>
        {GRADES.map((g) => <option key={g} value={g}>{g} or better</option>)}
      </select></div>
    {error && <p role="alert" className="field-error">{error}</p>}
    <button type="submit" className="button button--primary">Save</button>
  </form>;
}
