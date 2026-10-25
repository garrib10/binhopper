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
    session.add_all([StockListing(store_id=shop.id, pressing_id=vinyl.id, price=40, condition='VG+'),
                     StockListing(store_id=shop.id, pressing_id=cd.id, price=20, condition='New')])
    session.commit()
    assert client.get('/api/search?q=Cross&lp=true&new=true&under_30=true').json()['albums'] == []
