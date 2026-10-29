import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { type AlbumSummary, getCatalog } from '../catalog';
import { AlbumTile, Cover } from '../components/AlbumTile';
import { describeLoadError, LoadError, type LoadProblem } from '../components/LoadError';
import { loadLocation } from '../location';

interface ArtistDetail {
  id: number; name: string; bio: string | null; origin: string | null; image_url: string | null;
  genres: string[]; discogs_url: string; discography: Record<string, AlbumSummary[]>;
}
const KINDS = ['Studio', 'Live', 'Compilations'];
export function ArtistPage() {
  const { id } = useParams();
  const [saved] = useState(loadLocation);
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [error, setError] = useState<LoadProblem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [full, setFull] = useState(false);
  const [kind, setKind] = useState('Studio');
  useEffect(() => {
    const controller = new AbortController();
    setArtist(null); setError(null); setFull(false); setKind('Studio');
    getCatalog<ArtistDetail>(`/artists/${id}?zip=${saved.zip}&radius=${saved.radius}`, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setArtist(data); })
      .catch((cause) => { if (!controller.signal.aborted) setError(describeLoadError(cause, "That artist isn't in Binhopper.")); });
    return () => controller.abort();
  }, [id, saved, attempt]);
  if (!artist) return <main id="content" className="page"><h1 className="display">Artist</h1>{error ? <LoadError problem={error} onRetry={() => setAttempt(attempt + 1)} back={{ to: '/search', label: 'Back to search' }} /> : <p role="status">Loading artist…</p>}</main>;
  const bio = artist.bio ?? '';
  return <main id="content" className="catalog-page artist-page"><aside className="artist-profile"><Cover key={artist.id} url={artist.image_url} title={artist.name} portrait />
    <h1 className="display">{artist.name}</h1><p className="muted">{artist.genres.join(' · ')}{artist.genres.length ? ' · ' : ''}{artist.origin ?? 'Origin unavailable'}</p>
    <button className="button button--disabled" disabled>Sign in to follow</button>
    <Link className="artist-search-link" to={`/search?q=${encodeURIComponent(artist.name)}`}>Find records nearby</Link>
    <section aria-labelledby="bio-heading"><h2 className="eyebrow" id="bio-heading">About</h2><p id="artist-bio" className="artist-bio">{bio ? (full || bio.length <= 220 ? bio : `${bio.slice(0, 220).trimEnd()}…`) : 'Biography unavailable.'}</p>
      {bio.length > 220 && <button className="text-button" aria-expanded={full} aria-controls="artist-bio" onClick={() => setFull(!full)}>{full ? 'Show less' : 'Read full bio'}</button>}</section>
    <p className="attribution"><a href={artist.discogs_url} target="_blank" rel="noopener noreferrer">Data provided by Discogs.</a></p>
  </aside><section className="discography" aria-labelledby="discography-heading"><h2 id="discography-heading" className="section-title">Discography</h2><p className="muted">Oldest first</p>
    <div className="segmented" role="group" aria-label="Release type">{KINDS.map((name) => <button className="segmented__option" key={name} aria-pressed={kind === name} onClick={() => setKind(name)}>{name}</button>)}</div>
    <div className="discography-list">{artist.discography[kind]?.map((album) => <AlbumTile key={album.id} album={album} radius={saved.radius} compact />)}
      {!artist.discography[kind]?.length && <p className="muted">No {kind.toLowerCase()} releases listed yet.</p>}</div>
  </section></main>;
}
