import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { type AlbumSummary, stockLine } from '../catalog';

export function Cover({ url, title, portrait = false }: { url: string | null; title: string; portrait?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  return <div className={`record-cover${portrait ? ' record-cover--portrait' : ''}`}>
    {url && !failed ? <img src={url} alt={`${title} ${portrait ? 'photo' : 'cover'}`} onError={() => setFailed(true)} />
      : <span role="img" aria-label={`${title}: ${portrait ? 'photo' : 'cover'} unavailable`} className={portrait ? 'portrait-placeholder' : 'record-placeholder'}>{portrait ? 'Artist photo unavailable' : <span />}</span>}
  </div>;
}
export function AlbumTile({ album, radius, compact = false }: { album: AlbumSummary; radius: number; compact?: boolean }) {
  return <Link className={`album-tile${compact ? ' album-tile--compact' : ''}`} to={`/albums/${album.id}`}><Cover url={album.cover_url} title={album.title} />
    <strong>{album.title}</strong><span className="muted">{album.artist.name}{album.year ? ` · ${album.year}` : ''}</span>
    <span className="stock-line" data-available={album.store_count > 0}>{compact ? (album.store_count ? `${album.store_count} nearby` : 'Not nearby') : stockLine(album, radius)}</span></Link>;
}
