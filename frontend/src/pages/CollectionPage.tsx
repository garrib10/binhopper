import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchCollection, gradePair, type CollectionResponse, type CollectionSort } from '../collection';
import { Cover } from '../components/AlbumTile';

const SORTS: [CollectionSort, string][] = [['recent', 'Recently added'], ['artist', 'Artist A–Z'], ['genre', 'Genre'], ['year', 'Year']];
const added = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; data: CollectionResponse };

/** Collection (SPEC.md › Collection; mockups Collection.dc.html + DesktopCollection.dc.html). */
export function CollectionPage() {
  const [params, setParams] = useSearchParams();
  const sort = (SORTS.find(([key]) => key === params.get('sort'))?.[0] ?? 'recent') as CollectionSort;
  const view = params.get('view') === 'list' ? 'list' : 'grid';
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchCollection(sort, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ kind: 'loaded', data }); })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'error' }); });
    return () => controller.abort();
  }, [sort, attempt]);
  const set = (name: string, value: string) => { const next = new URLSearchParams(params); next.set(name, value); setParams(next, { replace: true }); };

  return <main id="content" className="page collection-page">
    <header className="collection-header">
      <h1 className="display">Collection</h1>
      <nav aria-label="Collection actions" className="collection-actions">
        <Link className="button button--secondary" to="/import">Import from Discogs</Link>
        <Link className="button button--primary" to="/search">Add a record</Link>
      </nav>
    </header>
    {state.kind === 'loaded' && <dl className="collection-stats">
      <div><dt>Records</dt><dd>{state.data.stats.records}</dd></div>
      <div><dt>Artists</dt><dd>{state.data.stats.artists}</dd></div>
      <div><dt>Wishlist</dt><dd>{state.data.stats.wishlist}</dd></div>
      {state.data.stats.duplicates > 0 && <div><dt>Duplicates</dt><dd>{state.data.stats.duplicates}</dd></div>}
    </dl>}
    <div className="collection-controls">
      <div className="segmented" role="group" aria-label="Sort">{SORTS.map(([key, label]) =>
        <button key={key} type="button" className="segmented__option" aria-pressed={sort === key} onClick={() => set('sort', key)}>{label}</button>)}</div>
      <div className="segmented segmented--compact" role="group" aria-label="View">
        <button type="button" className="segmented__option" aria-pressed={view === 'grid'} onClick={() => set('view', 'grid')}>Grid</button>
        <button type="button" className="segmented__option" aria-pressed={view === 'list'} onClick={() => set('view', 'list')}>List</button>
      </div>
    </div>
    {state.kind === 'loading' && <p role="status">Loading your collection…</p>}
    {state.kind === 'error' && <div className="error-state">
      <p role="alert" className="notice notice--danger">Can't reach Binhopper right now.</p>
      <button type="button" className="button button--primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
    </div>}
    {state.kind === 'loaded' && state.data.items.length === 0 && <div className="empty">
      <h2 className="section-title">No records yet</h2>
      <p>Find an album and choose "Add to collection", or import your Discogs collection.</p>
    </div>}
    {state.kind === 'loaded' && state.data.items.length > 0 && (view === 'grid'
      ? <ul className="collection-grid">{state.data.items.map((copy) => <li key={copy.id}>
        <Link className="collection-tile" to={`/collection/${copy.id}`}>
          <Cover url={copy.album.cover_url} title={copy.album.title} />
          {gradePair(copy) && <span className="collection-tile__grade">{gradePair(copy)}</span>}
          <strong>{copy.album.title}</strong>
          <span className="muted">{copy.album.artist.name} · {copy.pressing.note}{copy.copy_number > 1 ? ` · copy ${copy.copy_number}` : ''}</span>
        </Link></li>)}</ul>
      : <div className="collection-table-wrap"><table className="collection-table">
        <thead><tr><th scope="col">Album</th><th scope="col">Artist</th><th scope="col">Pressing</th><th scope="col">Media / Sleeve</th><th scope="col">Added</th></tr></thead>
        <tbody>{state.data.items.map((copy) => <tr key={copy.id}>
          <td><Link to={`/collection/${copy.id}`}>{copy.album.title}</Link></td>
          <td>{copy.album.artist.name}</td>
          <td>{copy.pressing.note}{copy.copy_number > 1 ? ` (copy ${copy.copy_number})` : ''}</td>
          <td>{gradePair(copy) ?? '–'}</td>
          <td>{added.format(new Date(copy.added_at))}</td>
        </tr>)}</tbody></table></div>)}
  </main>;
}
