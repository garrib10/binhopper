import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { type AlbumDetail, getCatalog } from '../catalog';
import { Cover } from '../components/AlbumTile';
import { HeartButton } from '../components/HeartButton';
import { useAuth } from '../AuthContext';
import { fetchOwned } from '../collection';
import { loadLocation } from '../location';

export function AlbumPage() {
  const { id } = useParams();
  const [saved] = useState(loadLocation);
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('tracks');
  useEffect(() => {
    const controller = new AbortController();
    setAlbum(null); setError(''); setTab('tracks');
    getCatalog<AlbumDetail>(`/albums/${id}?zip=${saved.zip}&radius=${saved.radius}`, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setAlbum(data); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof ApiError && cause.status === 404 ? cause.message : "Can't reach Binhopper right now."); });
    return () => controller.abort();
  }, [id, saved, attempt]);
  if (!album) return <main id="content" className="page"><h1 className="display">Album</h1>
    {error ? <><p role="alert">{error}</p><button className="button" onClick={() => setAttempt(attempt + 1)}>Try again</button></> : <p role="status">Loading album…</p>}</main>;
  const sides = new Map<string, typeof album.tracklist>();
  for (const track of album.tracklist) {
    const side = /^[A-Z]\d/i.test(track.position) ? `Side ${track.position[0].toUpperCase()}` : 'Tracks';
    sides.set(side, [...(sides.get(side) ?? []), track]);
  }
  const query = encodeURIComponent(`${album.artist.name} ${album.title}`);
  return <main id="content" className="catalog-page album-page">
    <div className="album-primary"><div className="album-art"><Cover key={album.id} url={album.cover_url} title={album.title} /></div>
    <aside className="album-actions"><Link className="find-stores" to={`/albums/${album.id}/stores`}><strong>Find in stores</strong><span>{album.store_count} within {saved.radius} mi of {saved.zip}{album.lowest_price !== null ? ` · from $${album.lowest_price.toFixed(2)}` : ''}</span></Link>
      <HeartButton albumId={album.id} title={album.title} labelled />
      <CollectionLink albumId={album.id} />
      <p className="eyebrow">Listen before you buy</p><div className="listen-links">
        <a href={`https://open.spotify.com/search/${query}`} target="_blank" rel="noopener noreferrer">Spotify</a>
        <a href={`https://music.apple.com/us/search?term=${query}`} target="_blank" rel="noopener noreferrer">Apple Music</a>
      </div><p className="attribution"><a href={album.discogs_url} target="_blank" rel="noopener noreferrer">Data provided by Discogs.</a></p></aside>
    </div><div className="album-content">
    <header className="album-heading"><h1 className="display">{album.title}</h1>
      <p><Link to={`/artists/${album.artist.id}`}>{album.artist.name}</Link> <span className="muted"> · {[album.year, album.label].filter(Boolean).join(' · ')}</span></p>
      <div className="genre-tags">{album.genres.map((g) => <span className="tag" key={g}>{g}</span>)}</div></header>
    <section className="album-details" aria-label="Album details"><div className="segmented" role="group" aria-label="Album sections">
      <button className="segmented__option" aria-pressed={tab === 'tracks'} onClick={() => setTab('tracks')}>Tracklist</button>
      <button className="segmented__option" aria-pressed={tab === 'pressings'} onClick={() => setTab('pressings')}>Pressings ({album.pressings.length})</button></div>
      {tab === 'tracks' ? <div className="track-sides">{[...sides].map(([side, tracks]) => <section className="track-side" key={side}><h2>{side}</h2><ol>{tracks.map((t, i) => <li key={`${t.position}-${i}`}><span>{t.position}</span>{t.title}</li>)}</ol></section>)}{!album.tracklist.length && <p>Tracklist unavailable.</p>}</div>
        : <div className="pressing-list"><p className="muted">Same album, different vinyl. Stock and prices are matched to each pressing.</p>{album.pressings.map((p) => <Link key={p.id} className="pressing-card" to={`/albums/${album.id}/stores`}><strong>{p.variant_note ?? p.format}</strong><span className="muted">{p.label} · {p.format}</span>{p.exclusive_kind && <span className="tag">{p.exclusive_kind === 'artist' ? 'Artist store exclusive' : 'Retailer exclusive'}</span>}</Link>)}{!album.pressings.length && <p>No vinyl pressings listed yet.</p>}</div>}
    </section></div></main>;
}

/** "Add to collection", plus how many copies you already own when signed in. */
function CollectionLink({ albumId }: { albumId: number }) {
  const { state } = useAuth();
  const [owned, setOwned] = useState(0);
  const signedIn = state.status === 'signed-in';
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    fetchOwned(albumId, controller.signal)
      .then((r) => setOwned(Object.values(r.copies).reduce((a, b) => a + b, 0))).catch(() => {});
    return () => controller.abort();
  }, [albumId, signedIn]);
  return <>
    {owned > 0 && <p className="tag tag--ok">In your collection · {owned} {owned === 1 ? 'copy' : 'copies'}</p>}
    <Link className="button button--secondary button--block" to={`/collection/add/${albumId}`}>Add to collection</Link>
  </>;
}
