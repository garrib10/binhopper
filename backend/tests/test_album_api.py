from datetime import timedelta

from sqlalchemy import select

from app.catalog_read import safe_image
from app.models import Album
from scripts.seed_sample import load
from tests.helpers import NOW


def test_album_detail_uses_real_catalog_and_saved_radius(client, session):
    load(session)
    album = session.scalar(select(Album))
    data = client.get(f'/api/albums/{album.id}?zip=10011&radius=10').json()
    assert data['title'] == 'Rumours' and data['artist']['name'] == 'Fleetwood Mac'
    assert data['store_count'] == 2 and data['lowest_price'] == 18
    assert data['tracklist'][0] == {'position': 'A1', 'title': 'Second Hand News'}
    assert len(data['pressings']) == 2
    assert set(data['genres']) == {'Rock', 'Soft Rock', 'Pop Rock'}
    assert data['cover_url'] is None
    assert data['discogs_url'].startswith('https://www.discogs.com/')


def test_missing_invalid_and_expired_album(client, session):
    load(session)
    album = session.scalar(select(Album))
    assert client.get('/api/albums/999999').status_code == 404
    assert client.get(f'/api/albums/{album.id}?zip=1234').status_code == 422
    assert client.get(f'/api/albums/{album.id}?radius=7').status_code == 422
    album.api_fetched_at = NOW - timedelta(hours=6)
    assert client.get(f'/api/albums/{album.id}').status_code == 404


def test_cover_requires_fresh_trusted_api_provenance():
    assert safe_image('https://i.discogs.com/cover.jpg', NOW, NOW)
    assert safe_image('https://i.discogs.com/cover.jpg', NOW - timedelta(hours=6), NOW) is None
    assert safe_image('https://evil.example/cover.jpg', NOW, NOW) is None
    assert safe_image('https://i.discogs.com/cover.jpg', None, NOW) is None
