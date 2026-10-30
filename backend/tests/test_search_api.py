import pytest
from scripts.seed_sample import load


@pytest.mark.parametrize('q', ['Rumours', 'fleetwood', 'Warner'])
def test_search_matches_title_artist_and_label(client, session, q):  # AC-12
    load(session)
    data = client.get('/api/search', params={'q': q}).json()
    assert [a['title'] for a in data['albums']] == ['Rumours']
    assert data['albums'][0]['store_count'] == 4


def test_search_short_query_artist_type_and_literal_wildcards(client, session):  # AC-12
    load(session)
    assert client.get('/api/search?q=R').json()['albums'] == []
    assert client.get('/api/search?q=%25%25').json()['albums'] == []
    assert client.get('/api/search?q=Fleet&type=artists').json()['artists'][0]['name'] == 'Fleetwood Mac'
    assert client.get('/api/search?q=aa&type=wrong').status_code == 422


def test_search_filters_apply_to_same_pressing_listing_and_location(client, session):
    load(session)
    data = client.get('/api/search?q=Rumours&lp=true&new=true&under_30=true&in_stock_nearby=true&radius=10').json()
    assert len(data['albums']) == 1
    assert data['albums'][0]['store_count'] == 1
    assert data['albums'][0]['lowest_price'] == 26
    assert client.get('/api/search?q=Rumours&used=true&under_30=true').json()['albums'][0]['lowest_price'] == 18
    assert client.get('/api/search?q=Rumours&zip=99999').status_code == 404
    assert client.get('/api/search?q=Rumours&radius=7').status_code == 422


def test_genre_decade_year_browse_and_validation(client, session):
    load(session)
    assert client.get('/api/browse?genre=Rock&decade=1970&year=1977').json()['albums'][0]['title'] == 'Rumours'
    assert client.get('/api/browse?genre=Rock&year=1980').json()['albums'] == []
    assert client.get('/api/browse?genre=Rock&decade=1971').status_code == 422
    assert client.get('/api/browse?genre=Rock&decade=1970&year=1980').status_code == 422
    assert client.get('/api/browse?genre=Rock&sort=near').json()['albums'][0]['store_count'] == 4


def test_filters_cannot_match_different_pressings_of_the_same_album(client, session):
    from sqlalchemy import select
    from app.models import Album, Artist, Pressing, StockListing, Store
    load(session)
    artist = session.scalar(select(Artist))
    shop = session.scalar(select(Store))
    album = Album(artist_id=artist.id, title='Cross pressing case')
    session.add(album)
    session.flush()
    vinyl = Pressing(album_id=album.id, format='LP')
    cd = Pressing(album_id=album.id, format='CD')
    session.add_all([vinyl, cd])
    session.flush()
    session.add_all([StockListing(source="manual", store_id=shop.id, pressing_id=vinyl.id, price=40, condition='VG+'),
                     StockListing(source="manual", store_id=shop.id, pressing_id=cd.id, price=20, condition='New')])
    session.commit()
    assert client.get('/api/search?q=Cross&lp=true&new=true&under_30=true').json()['albums'] == []


def add_genres(session, *rows):
    from sqlalchemy import select
    from app.models import Album, AlbumGenre, Artist
    artist = session.scalar(select(Artist))
    for title, genre, styles in rows:
        album = Album(artist_id=artist.id, title=title)
        session.add(album)
        session.flush()
        session.add_all([AlbumGenre(album_id=album.id, genre=genre, style=s) for s in styles] or
                        [AlbumGenre(album_id=album.id, genre=genre, style=None)])
    session.commit()


def test_genres_list_every_genre_with_its_styles(client, session):  # Search rule 5
    load(session)
    add_genres(session, ('Loveless', 'Rock', ['Shoegaze', 'Noise']), ('Souvlaki', 'Rock', ['Shoegaze']),
               ('Kind of Blue', 'Jazz', ['Modal']), ('Brass album', 'Brass & Military', []))
    data = client.get('/api/genres').json()['genres']
    assert [g['name'] for g in data] == ['Rock', 'Brass & Military', 'Jazz']  # most albums first, then A–Z
    rock = data[0]
    assert rock['albums'] == 3  # Rumours has two styles but counts once
    assert rock['styles'][0] == 'Shoegaze'
    assert set(rock['styles']) == {'Shoegaze', 'Noise', 'Pop Rock', 'Soft Rock'}
    assert data[1]['styles'] == []


def test_search_suggests_matching_genres_and_styles(client, session):  # Search rule 1
    load(session)
    add_genres(session, ('Loveless', 'Rock', ['Shoegaze']), ('Shoegaze pop', 'Pop', ['Shoegaze']),
               ('Souvlaki', 'Rock', ['Shoegaze']))
    data = client.get('/api/search', params={'q': 'shoe'}).json()
    assert data['genres'] == [{'name': 'Shoegaze', 'genre': 'Rock'}]  # filed under Rock most
    assert client.get('/api/search', params={'q': 'rock'}).json()['genres'][:2] == [
        {'name': 'Rock', 'genre': 'Rock'}, {'name': 'Pop Rock', 'genre': 'Rock'}]  # starts-with first
    assert client.get('/api/search', params={'q': '%%'}).json()['genres'] == []
    assert client.get('/api/search', params={'q': 'shoe', 'offset': 50}).json()['genres'] == []
    assert client.get('/api/search', params={'q': 'shoe', 'type': 'artists'}).json()['genres'] == []


def test_browse_by_style(client, session):  # Search rule 5
    load(session)
    add_genres(session, ('Loveless', 'Rock', ['Shoegaze']))
    assert [a['title'] for a in client.get('/api/browse?genre=Shoegaze').json()['albums']] == ['Loveless']
