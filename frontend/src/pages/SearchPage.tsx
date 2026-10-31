import '../styles/search.css';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { HeartButton } from '../components/HeartButton';
import { loadLocation } from '../location';
import { browsePath, fetchGenres, fetchSearch, type Genre, type SearchAlbum, type SearchResult } from '../search';

// Shown until the catalog's own list loads (and if it can't): Discogs' main genres.
export const GENRES = ['Rock', 'Jazz', 'Funk / Soul', 'Hip Hop', 'Electronic', 'Folk, World, & Country', 'Reggae', 'Classical', 'Pop', 'Blues', 'Latin', 'Stage & Screen'];
const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const FILTERS = [['in_stock_nearby', 'In stock nearby'], ['lp', 'LP'], ['new', 'New'], ['used', 'Used'], ['under_30', 'Under $30']];
const EMPTY: SearchResult = { albums: [], artists: [] };
const FALLBACK: Genre[] = GENRES.map((name) => ({ name, albums: 0, styles: [] }));
/** The catalog's genres first (most albums, with their styles), then the rest of the starter list,
 *  so a small catalog never shrinks the picker to a few buttons. */
const withStarters = (catalog: Genre[]) => [...catalog, ...FALLBACK.filter((g) => !catalog.some((c) => c.name === g.name))];

function ResultRow({ album, radius, grid }: { album: SearchAlbum; radius: number; grid: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [album.cover_url]);
  const stock = album.store_count ? `${album.store_count} ${album.store_count === 1 ? 'store' : 'stores'} within ${radius} mi${album.lowest_price !== null ? ` · from $${album.lowest_price.toFixed(2)}` : ''}`
    : album.nearest_outside_mi !== null ? `Nearest copy is ${album.nearest_outside_mi} mi away` : 'Not in stock nearby';
  return <article className="search-result"><Link className={`search-album${grid ? ' search-album--grid' : ''}`} to={`/albums/${album.id}`}>
    <span className="search-cover">{album.cover_url && !failed ? <img src={album.cover_url} alt={`${album.title} cover`} onError={() => setFailed(true)} /> : <span className="search-vinyl" aria-hidden="true"><span /></span>}</span>
    <span className="search-album__info"><strong>{album.title}</strong><span className="muted">{album.artist.name}{album.year ? ` · ${album.year}` : ''} · {album.format}</span><span className={album.store_count ? 'search-stock' : 'muted'}>{stock}</span></span>
  </Link><HeartButton albumId={album.id} title={album.title} /><a className="search-attribution" href={album.discogs_url} target="_blank" rel="noopener noreferrer">Data provided by Discogs.</a></article>;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const path = useLocation().pathname;
  const { genre: routeGenre } = useParams();
  const browse = path.startsWith('/genres');
  const picker = path === '/genres';
  const genre = routeGenre ?? params.get('genre') ?? '';  // on results, a style name works here too
  const style = params.get('style');
  const query = params.get('q') ?? '';
  const type = params.get('type') === 'artists' ? 'artists' : 'albums';
  const decade = Number(params.get('decade')) || null;
  const year = Number(params.get('year')) || null;
  const [saved] = useState(loadLocation);
  const [result, setResult] = useState<SearchResult>(EMPTY);
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [genres, setGenres] = useState<Genre[]>(FALLBACK);
  useEffect(() => {
    if (!picker) return;
    const controller = new AbortController();
    fetchGenres(controller.signal).then((list) => { if (list) setGenres(withStarters(list)); });
    return () => controller.abort();
  }, [picker]);
  const styles = genres.find((g) => g.name === genre)?.styles ?? [];
  const requestKey = params.toString();
  useEffect(() => {
    setResult(EMPTY); setError('');
    if (picker || (browse && !genre) || (!browse && query.trim().length < 2)) { setState('idle'); return; }
    const controller = new AbortController();
    // Mark loading immediately so stale results never survive a new query/filter.
    setState('loading');
    const timer = window.setTimeout(() => {
      const request = new URLSearchParams(requestKey);
      request.set('zip', saved.zip); request.set('radius', String(saved.radius));
      if (browse) { request.set('genre', genre); request.delete('q'); request.delete('type'); request.delete('style'); }
      else { request.set('q', query.trim()); request.set('type', type); }
      fetchSearch(browse ? 'browse' : 'search', request, controller.signal)
        .then((data) => { if (!controller.signal.aborted) { setResult(data); setState('loaded'); } })
        .catch((cause) => { if (!controller.signal.aborted) { setError(cause instanceof ApiError && cause.status < 500 ? cause.message : "Can't reach Binhopper right now."); setState('error'); } });
    }, browse ? 0 : 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [requestKey, query, genre, browse, picker, type, saved, attempt]);

  function change(name: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(name); else next.set(name, value);
    if (name === 'decade') next.delete('year');
    if (name === 'genre') next.delete('style');
    if (name !== 'offset') next.delete('offset');
    setParams(next);
  }
  return <main id="content" className={`search-page${picker ? ' search-page--picker' : ''}`}><aside className="search-controls">
    <h1 className="display">{picker ? 'Browse' : browse ? `${genre}${year ? ` · ${year}` : decade ? ` · ${decade}s` : ''}` : 'Find a record'}</h1>
    <nav aria-label="Search by" className="search-types"><Link aria-current={!browse && type === 'albums' ? 'page' : undefined} to={`/search?${new URLSearchParams({ ...Object.fromEntries(params), type: 'albums' })}`}>Albums</Link>
      <Link aria-current={!browse && type === 'artists' ? 'page' : undefined} to={`/search?${new URLSearchParams({ ...Object.fromEntries(params), type: 'artists' })}`}>Artists</Link>
      <Link aria-current={browse ? 'page' : undefined} to="/genres">Genre &amp; year</Link></nav>
    <p className="muted search-location">{saved.radius} mi of {saved.zip} · <Link to="/albums/1/stores">Change location</Link></p>
    {!picker && (browse || type === 'albums') && <fieldset className="search-filters"><legend className="sr-only">Filter records</legend>{FILTERS.map(([name, label]) => <label key={name}><input type="checkbox" checked={params.get(name) === 'true'} onChange={(e) => change(name, e.target.checked ? 'true' : null)} />{label}</label>)}</fieldset>}
    {picker && <div className="browse-steps"><section aria-labelledby="genre-heading"><h2 id="genre-heading" className="eyebrow">1 · Genre</h2><div className="genre-picker">{genres.map(({ name }) => <button aria-pressed={genre === name} key={name} onClick={() => change('genre', name)}>{name}</button>)}</div></section>
      {genre && styles.length > 0 && <section aria-labelledby="style-heading"><h2 id="style-heading" className="eyebrow">2 · Style (optional)</h2><div className="browse-pills"><button aria-pressed={style === null} onClick={() => change('style', null)}>All {genre}</button>{styles.map((s) => <button key={s} aria-pressed={style === s} onClick={() => change('style', style === s ? null : s)}>{s}</button>)}</div></section>}
      {genre && <><section aria-labelledby="decade-heading"><h2 id="decade-heading" className="eyebrow">{styles.length ? 3 : 2} · Decade</h2><div className="browse-pills"><button aria-pressed={decade === null} onClick={() => change('decade', null)}>Any decade</button>{DECADES.map((d) => <button key={d} aria-pressed={decade === d} onClick={() => change('decade', String(d))}>{d}s</button>)}</div></section>
        {decade && <section aria-labelledby="year-heading"><h2 id="year-heading" className="eyebrow">{styles.length ? 4 : 3} · Year (optional)</h2><div className="browse-pills"><button aria-pressed={year === null} onClick={() => change('year', null)}>Any year</button>{Array.from({ length: 10 }, (_, i) => decade + i).map((y) => <button key={y} aria-pressed={year === y} onClick={() => change('year', year === y ? null : String(y))}>{y}</button>)}</div></section>}</>}
      {genre && <Link className="browse-cta" to={browsePath(style ?? genre, genre, params)}>Show {style ?? genre}{year ? ` from ${year}` : decade ? ` from the ${decade}s` : ''}</Link>}
    </div>}
    {browse && !picker && <Link className="browse-back" to={`/genres?${new URLSearchParams({ ...Object.fromEntries(params), genre: params.get('genre') ?? genre })}`}>Change genre or year</Link>}
  </aside><section className="search-results" aria-label="Search results" aria-live="polite" aria-busy={state === 'loading'}>
    {browse && !picker && genre && <><div className="segmented" role="group" aria-label="Sort"><button className="segmented__option" aria-pressed={params.get('sort') !== 'near'} onClick={() => change('sort', 'popular')}>Most popular</button><button className="segmented__option" aria-pressed={params.get('sort') === 'near'} onClick={() => change('sort', 'near')}>In stock near me</button></div></>}
    {!picker && state === 'idle' && <p className="muted">{browse ? 'Choose a genre to explore vinyl by decade and year.' : 'Type at least 2 characters to search artist, album or label, or browse by genre.'}</p>}
    {state === 'loading' && <p role="status">Searching records…</p>}
    {state === 'error' && <><p role="alert">{error}</p><button className="button" onClick={() => setAttempt(attempt + 1)}>Try again</button></>}
    {state === 'loaded' && !browse && !!result.genres?.length && <nav className="search-genres" aria-label="Matching genres and styles">
      {result.genres.map((g) => <Link key={g.name} to={browsePath(g.name, g.genre)}>Browse {g.name} →</Link>)}</nav>}
    {state === 'loaded' && <><p className="eyebrow">{result.albums.length + result.artists.length} results</p>
      {result.albums.length + result.artists.length === 0 ? result.genres?.length ? null : <div className="empty"><h2 className="section-title">No records found</h2><p>Check your spelling or try another artist, album or label.</p><Link to="/genres">Browse by genre</Link></div>
        : <div className={browse ? 'search-grid' : 'search-list'}>{result.albums.map((album) => <ResultRow key={album.id} album={album} radius={saved.radius} grid={browse} />)}{result.artists.map((artist) => <Link className="search-artist" key={artist.id} to={`/artists/${artist.id}`}><strong>{artist.name}</strong><span className="muted">View artist and discography →</span></Link>)}</div>}
      {(Number(params.get('offset')) > 0 || result.albums.length + result.artists.length === 50) && <nav className="search-pagination" aria-label="Search pages">
        {Number(params.get('offset')) > 0 && <button className="button" onClick={() => change('offset', String(Math.max(0, Number(params.get('offset')) - 50)))}>Previous results</button>}
        {result.albums.length + result.artists.length === 50 && <button className="button" onClick={() => change('offset', String(Number(params.get('offset') ?? 0) + 50))}>More results</button>}
      </nav>}
    </>}
  </section></main>;
}
