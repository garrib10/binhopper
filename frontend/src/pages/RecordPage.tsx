import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { Cover } from '../components/AlbumTile';
import { GotItPrompt } from '../components/GotItPrompt';
import { HeartButton } from '../components/HeartButton';
import { fetchListing, pendingHandoffs, recordHandoff, type HandoffListing } from '../handoff';
import '../styles/handoff.css';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const STEPS = ['Find', 'Locate', 'Buy', 'Collect'];

/** Locate, hold or buy one copy (SPEC.md › Locate, hold, buy; mockup Record.dc.html). */
export function RecordPage() {
  const { id = '' } = useParams();
  const [record, setRecord] = useState<HandoffListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(() => pendingHandoffs().find((h) => h.listingId === Number(id)) ?? null);
  useEffect(() => {
    const controller = new AbortController();
    fetchListing(Number(id), controller.signal).then(setRecord).catch((err) => {
      if (!controller.signal.aborted) setError(err instanceof ApiError && err.status === 404 ? 'This copy is no longer listed. It may have sold.' : "Can't reach Binhopper right now.");
    });
    return () => controller.abort();
  }, [id]);

  if (!record) return <main id="content" className="page"><h1 className="display">Locate, hold or buy</h1>
    {error ? <p role="alert">{error} <Link to="/search">Back to search</Link></p> : <p role="status">Loading…</p>}</main>;
  const { album, store, pressing } = record;
  const handedOff = () => {
    recordHandoff({ listingId: record.listing_id, albumId: album.id, albumTitle: album.title, storeName: store.name });
    setAsking(pendingHandoffs().find((h) => h.listingId === record.listing_id) ?? null);
  };
  const phone = store.phone?.replace(/[^+\d]/g, '');
  const step = asking ? 2 : 1;  // Find ✓ → Locate → Buy (handed off) → Collect
  return <main id="content" className="page record-page">
    <div className="record-page__top">
      <Link className="back-link" to={`/albums/${album.id}/stores`}>← Nearby stock</Link>
      <HeartButton albumId={album.id} title={album.title} />
    </div>
    <header className="record-header">
      <div className="record-header__cover"><Cover url={album.cover_url} title={album.title} /></div>
      <div><h1 className="display">{album.title}</h1><p>{album.artist}</p>
        <p className="muted">{[album.year, pressing.label, [pressing.format, pressing.note].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p></div>
    </header>
    <ol className="record-steps" aria-label="Progress">{STEPS.map((label, i) =>
      <li key={label} aria-current={i === step ? 'step' : undefined} data-done={i < step}>{label}</li>)}</ol>
    <section className="record-shop" aria-labelledby="shop-name">
      <div className="record-shop__row">
        <div><h2 id="shop-name" className="record-shop__name">{store.name}</h2>
          <p className="muted">{[store.area, store.address].filter(Boolean).join(' · ')}</p>
          <p>{record.condition}{pressing.note ? ` · ${pressing.note}` : ''} · {record.quantity} in stock</p></div>
        <span className="record-shop__price">{money.format(record.price)}</span>
      </div>
      <p className="muted">Holds and orders happen with the shop for now: call to hold it, or buy from its listing.</p>
      <div className="record-shop__actions">
        <a className="button" href={`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`} onClick={handedOff}>Directions</a>
        {phone && <a className="button" href={`tel:${phone}`} onClick={handedOff}>Call store</a>}
        {store.website && <a className="button" href={store.website} target="_blank" rel="noopener noreferrer" onClick={handedOff}>Shop website</a>}
        {record.discogs_url && <a className="button button--primary" href={record.discogs_url} target="_blank" rel="noopener noreferrer" onClick={handedOff}>Buy on Discogs</a>}
      </div>
    </section>
    {asking && <GotItPrompt handoff={asking} onDone={() => setAsking(null)} />}
    <Link className="text-link" to={`/albums/${album.id}/stores`}>Compare other stores in range</Link>
  </main>;
}
