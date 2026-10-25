from datetime import timedelta

from sqlalchemy import select

from app.models import Album, Artist
from scripts.seed_sample import load
from tests.helpers import NOW


def test_artist_bio_genres_discography_and_nearby_badges(client, session):
    load(session)
    artist = session.scalar(select(Artist))
    original = session.scalar(select(Album))
    early = Album(artist_id=artist.id, title='Earlier studio', year=1969)
    live = Album(artist_id=artist.id, title='Live record', year=1980)
    live.release_type = 'Live'
    compilation = Album(artist_id=artist.id, title='Compilation', year=1988)
    compilation.release_type = 'Compilations'
    session.add_all([early, live, compilation])
    session.commit()
    data = client.get(f'/api/artists/{artist.id}?zip=10011&radius=10').json()
    assert data['name'] == 'Fleetwood Mac' and data['bio']
    assert 'Rock' in data['genres']
    assert [a['title'] for a in data['discography']['Studio']] == ['Earlier studio', 'Rumours']
    assert data['discography']['Studio'][1]['store_count'] == 2
    # Transient class metadata also works on the pre-catalog-migration stack.
    assert data['discography']['Live'][0]['title'] == 'Live record'
    assert data['discography']['Compilations'][0]['title'] == 'Compilation'
    assert data['image_url'] is None
    original.api_fetched_at = NOW - timedelta(hours=6)
    assert len(client.get(f'/api/artists/{artist.id}').json()['discography']['Studio']) == 1


def test_missing_or_expired_artist_is_hidden(client, session):
    load(session)
    artist = session.scalar(select(Artist))
    assert client.get('/api/artists/9999999').status_code == 404
    artist.api_fetched_at = NOW - timedelta(hours=6)
    assert client.get(f'/api/artists/{artist.id}').status_code == 404
