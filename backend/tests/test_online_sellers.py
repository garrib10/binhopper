"""AC-03 fallback links and AC-04 validation; no external network requests."""
from urllib.parse import parse_qs, urlsplit
from datetime import timedelta
from app.config import settings
from app.models import Album, Artist
from scripts.seed_sample import load
from tests.helpers import NOW


def test_AC_03_online_searches_encode_album_and_artist_without_prices(client, session, monkeypatch):
    load(session)
    album = session.query(Album).first()
    album.title = 'Blue & Green / Deluxe?'
    session.commit()
    monkeypatch.setattr(settings, 'artist_store_urls', {album.artist_id: 'https://artist.example/shop'})
    data = client.get(f'/api/albums/{album.id}/online').json()
    assert [s['name'] for s in data['sellers']] == ['Fleetwood Mac official store', 'Discogs marketplace', 'eBay', 'Amazon', 'Urban Outfitters']
    for seller in data['sellers'][1:]:
        assert seller.keys() == {'name', 'url'}
        assert 'Blue & Green / Deluxe?' in next(iter(parse_qs(urlsplit(seller['url']).query).values()))[0]


def test_AC_03_official_store_is_never_guessed_or_unsafe(client, session, monkeypatch):
    load(session)
    album = session.query(Album).first()
    for url in [None, 'javascript:alert(1)', 'https://user:password@artist.example/']:
        monkeypatch.setattr(settings, 'artist_store_urls', {} if url is None else {album.artist_id: url})
        assert len(client.get(f'/api/albums/{album.id}/online').json()['sellers']) == 4


def test_AC_04_unknown_and_expired_album_returns_404(client, session):
    assert client.get('/api/albums/999999/online').status_code == 404
    assert client.get('/api/albums/no/online').status_code == 422
    artist = Artist(name='Expired fixture')
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title='Expired', api_fetched_at=NOW-timedelta(hours=6))
    session.add(album)
    session.commit()
    assert client.get(f'/api/albums/{album.id}/online').status_code == 404
