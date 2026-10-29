import { useAuth } from '../AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchCollection, gradePair, type CollectionResponse, type CollectionSort } from '../collection';
import { Cover } from '../components/AlbumTile';
import { ListPlaceholder } from '../components/ListPlaceholder';
import { useCachedList } from '../listCache';

const SORTS: [CollectionSort, string][] = [['recent', 'Recently added'], ['artist', 'Artist A–Z'], ['genre', 'Genre'], ['year', 'Year']];
const added = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Collection (SPEC.md › Collection; mockups Collection.dc.html + DesktopCollection.dc.html). */
export function CollectionPage() {
  const [params, setParams] = useSearchParams();
  const sort = (SORTS.find(([key]) => key === params.get('sort'))?.[0] ?? 'recent') as CollectionSort;
  const view = params.get('view') === 'list' ? 'list' : 'grid';
  const { state: auth } = useAuth();
  // A return visit shows the last list at once while it refreshes.
  const { state, reload } = useCachedList<CollectionResponse>(auth.status === 'signed-in' ? auth.account.id : null,
    `collection:${sort}`, (signal) => fetchCollection(sort, signal));
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
    {state.kind === 'loading' && <ListPlaceholder label="Loading your collection…" layout={view} />}
    {state.kind === 'error' && <div className="error-state">
      <p role="alert" className="notice notice--danger">Can't reach Binhopper right now.</p>
      <button type="button" className="button button--primary" onClick={reload}>Try again</button>
    </div>}
    {state.kind === 'loaded' && state.data.items.length === 0 && <div className="empty">
      <h2 className="section-title">No records yet</h2>
      <p>Find an album and choose "Add to collection", or import your Discogs collection.</p>
    </div>}
    {state.kind === 'loaded' && state.data.items.length > 0 && (view === 'grid'
      ? <ul className="collection-grid" aria-busy={state.refreshing}>{state.data.items.map((copy) => <li key={copy.id}>
        <Link className="collection-tile" to={`/collection/${copy.id}`}>
          <Cover url={copy.album.cover_url} title={copy.album.title} />
          {/* No condition yet: a nudge, since only the pressing is required (rule 2). */}
          <span className={`collection-tile__grade${gradePair(copy) ? '' : ' collection-tile__grade--missing'}`}>{gradePair(copy) ?? 'Add condition'}</span>
          <strong>{copy.album.title}</strong>
          <span className="muted">{copy.album.artist.name} · {copy.pressing.note}{copy.copy_number > 1 ? ` · copy ${copy.copy_number}` : ''}</span>
        </Link></li>)}</ul>
      : <div className="collection-table-wrap"><table className="collection-table" aria-busy={state.refreshing}>
        <thead><tr><th scope="col">Album</th><th scope="col">Artist</th><th scope="col">Pressing</th><th scope="col">Media / Sleeve</th><th scope="col">Added</th></tr></thead>
        <tbody>{state.data.items.map((copy) => <tr key={copy.id}>
          <td><Link to={`/collection/${copy.id}`}>{copy.album.title}</Link></td>
          <td>{copy.album.artist.name}</td>
          <td>{copy.pressing.note}{copy.copy_number > 1 ? ` (copy ${copy.copy_number})` : ''}</td>
          <td>{gradePair(copy) ?? <Link to={`/collection/${copy.id}`} aria-label={`Add condition: ${copy.album.title}`}>Add condition</Link>}</td>
          <td>{added.format(new Date(copy.added_at))}</td>
        </tr>)}</tbody></table></div>)}
  </main>;
}
