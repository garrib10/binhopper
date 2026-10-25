import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { type AlbumSummary, stockLine } from '../catalog';

export function Cover({ url, title, portrait = false }: { url: string | null; title: string; portrait?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  return <div className={`record-cover${portrait ? ' record-cover--portrait' : ''}`}>
    {url && !failed ? <img src={url} alt={`${title} ${portrait ? 'photo' : 'cover'}`} onError={() => setFailed(true)} />
      : <span role="img" aria-label={`${title}: ${portrait ? 'photo' : 'cover'} unavailable`} className="record-placeholder"><span /></span>}
  </div>;
}
export function AlbumTile({ album, radius }: { album: AlbumSummary; radius: number }) {
  return <Link className="album-tile" to={`/albums/${album.id}`}><Cover url={album.cover_url} title={album.title} />
    <strong>{album.title}</strong><span className="muted">{album.artist.name}{album.year ? ` · ${album.year}` : ''}</span>
    <span className="stock-line">{stockLine(album, radius)}</span></Link>;
}
