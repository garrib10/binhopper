"""AC-01: only active, eligible directory shops contribute to nearby stock."""
from pathlib import Path
import json

import httpx
import osmium
import pytest
from sqlalchemy import select

from app.models import Album, Store
from scripts.build_shop_candidates import COLUMNS, build, write_csv
from scripts.load_shops import load_shops
from scripts.shop_websites import Reader, USER_AGENT, prefill, public_url
from scripts.seed_sample import load
from tests.helpers import NOW

FIXTURE = Path(__file__).parent/'fixtures/shops/directory.csv'


def row(key='fixture-records-town', **changes):
    return dict.fromkeys(COLUMNS, '') | {'shop_key': key, 'osm_id': 'node/1', 'name': 'Fixture Records',
        'town': 'Town', 'lat': '41.5', 'lng': '-72.5', 'verified': 'true', 'likely_status': 'record shop'} | changes


def test_AC_01_verified_only_idempotent_upsert_and_override(session):
    assert load_shops(session, FIXTURE, now=NOW) == 1
    store = session.scalar(select(Store).where(Store.shop_key == 'fixture-records-town'))
    identifier = store.id
    assert store.source == 'manual' and store.verified_at == NOW and store.active
    assert load_shops(session, FIXTURE, now=NOW) == 1
    assert store.id == identifier
    assert load_shops(session, FIXTURE, include_unverified=True, now=NOW) == 3
    pending = session.scalar(select(Store).where(Store.shop_key == 'pending-records-town'))
    assert pending.verified_at is None
    closed = session.scalar(select(Store).where(Store.shop_key == 'closed-records-town'))
    assert not closed.active


def test_AC_01_missing_and_closed_are_soft_retired_reactivation_keeps_id(session, tmp_path):
    load_shops(session, FIXTURE, include_unverified=True, now=NOW)
    original = session.scalar(select(Store).where(Store.shop_key == 'fixture-records-town'))
    identifier = original.id
    path = tmp_path/'directory.csv'
    write_csv(path, [row(likely_status='possibly closed', verified='false')])
    load_shops(session, path, now=NOW)
    assert not original.active
    assert all(not s.active for s in session.scalars(select(Store)))
    write_csv(path, [row(name='Renamed Fixture')])
    load_shops(session, path, now=NOW)
    assert original.active and original.id == identifier and original.name == 'Renamed Fixture'


@pytest.mark.parametrize('changes', [{'lat': 'nan'}, {'lat': '91'}, {'website': 'javascript:alert(1)'},
    {'verified': 'yes'}, {'shop_key': 'BAD KEY'}, {'osm_id': 'bad'}, {'phone': '1'*41}])
def test_AC_01_invalid_csv_is_atomic(session, tmp_path, changes):
    load_shops(session, FIXTURE, now=NOW)
    store = session.scalar(select(Store))
    path = tmp_path/'invalid.csv'
    write_csv(path, [row(name='Should not persist'), row(key='invalid-row', **({'osm_id': 'node/2'} | changes))])
    with pytest.raises(ValueError):
        load_shops(session, path, now=NOW)
    assert store.active and store.name == 'Fixture Records'


def test_AC_01_key_changes_cannot_duplicate_osm_and_hand_added_provenance(session, tmp_path):
    load_shops(session, FIXTURE, now=NOW)
    path = tmp_path/'directory.csv'
    write_csv(path, [row(key='changed-key')])
    with pytest.raises(ValueError, match='stable key'):
        load_shops(session, path)
    write_csv(path, [row(key='hand-added', osm_id='', notes='Manually researched; not from OSM')])
    assert load_shops(session, path) == 1
    assert session.scalar(select(Store).where(Store.shop_key == 'hand-added')).osm_id is None
    write_csv(path, [])
    with pytest.raises(ValueError, match='empty'):
        load_shops(session, path)


def test_AC_01_inactive_hidden_in_nearby_search_album_and_artist(client, session):
    load(session)
    album = session.scalar(select(Album))
    for store in session.scalars(select(Store)):
        store.active = False
    session.commit()
    stock = client.get(f'/api/albums/{album.id}/stock?zip=10011&radius=100').json()
    assert stock['stores'] == [] and stock['nearest_outside_mi'] is None
    assert client.get('/api/search?q=Rumours').json()['albums'][0]['store_count'] == 0
    assert client.get('/api/browse?genre=Rock').json()['albums'][0]['store_count'] == 0
    assert client.get('/api/search?q=Rumours&in_stock_nearby=true').json()['albums'] == []
    assert client.get(f'/api/albums/{album.id}').json()['store_count'] == 0
    artist = client.get(f'/api/artists/{album.artist_id}').json()
    assert artist['discography']['Studio'][0]['store_count'] == 0


def test_AC_01_offline_json_filters_missing_fields_and_key_collisions(tmp_path):
    elements = [
        {'type': 'node', 'id': 1, 'lat': 41, 'lon': -72, 'tags': {'name': 'Fixture Records', 'shop': 'music'}},
        {'type': 'way', 'id': 2, 'center': {'lat': 42, 'lon': -73}, 'tags': {'name': 'Fixture Records', 'music': 'vinyl'}},
        {'type': 'node', 'id': 3, 'tags': {'shop': 'books', 'name': 'Vinyl & Books'}},
        {'type': 'node', 'id': 4, 'tags': {'shop': 'books', 'name': 'Ignore Me'}},
    ]
    path = tmp_path/'overpass.json'
    path.write_text(json.dumps({'elements': elements}))
    rows = build(path)
    assert len(rows) == 3
    assert len({r['shop_key'] for r in rows}) == 3
    assert all(r['verified'] == 'false' and not r['discogs_seller_name'] for r in rows)
    assert next(r for r in rows if r['osm_id'] == 'node/3')['lat'] == ''


def test_AC_01_offline_pbf_node_and_way_geometry(tmp_path):
    path = tmp_path/'fixture.osm.pbf'
    with osmium.SimpleWriter(str(path)) as writer:
        writer.add_node(osmium.osm.mutable.Node(id=1, location=( -72, 41), tags={'shop': 'music', 'name': 'Fixture Records'}))
        writer.add_node(osmium.osm.mutable.Node(id=2, location=(-72.2, 41.2)))
        writer.add_node(osmium.osm.mutable.Node(id=3, location=(-72.2, 41)))
        writer.add_way(osmium.osm.mutable.Way(id=3, nodes=[1, 2], tags={'music': 'records', 'name': 'Fixture Two'}))
        writer.add_way(osmium.osm.mutable.Way(id=4, nodes=[1, 2, 3, 1], tags={'building': 'yes'}))
        writer.add_relation(osmium.osm.mutable.Relation(id=5, members=[('w', 4, 'outer')], tags={'type': 'multipolygon', 'shop': 'music', 'name': 'Fixture Relation'}))
    rows = build(path)
    assert len(rows) == 3
    way = next(r for r in rows if r['osm_id'] == 'way/3')
    assert way['lat'] == pytest.approx(41.1) and way['lng'] == pytest.approx(-72.1)
    relation = next(r for r in rows if r['osm_id'] == 'relation/5')
    assert relation['lat'] == pytest.approx(41.1) and relation['lng'] == pytest.approx(-72.1)


def test_AC_01_robots_max_two_pages_and_evidence_only(tmp_path):
    calls = []
    def handler(request):
        calls.append(request.url.path)
        assert request.headers['User-Agent'] == USER_AGENT
        if request.url.path == '/robots.txt':
            return httpx.Response(200, text='User-agent: *\nDisallow: /private')
        if request.url.path == '/':
            return httpx.Response(200, text='<a href="/contact">Contact</a><a href="/about">About</a>')
        if request.url.path == '/contact':
            return httpx.Response(200, text='<p>Phone: (203) 555-0101</p><p>Monday 10AM-6PM</p>'
                '<a href="https://www.discogs.com/seller/fixture-seller/profile">Shop</a>')
        raise AssertionError('Unexpected external/page call')
    candidate = row(website='https://shop.example/', verified='false')
    with httpx.Client(transport=httpx.MockTransport(handler), headers={'User-Agent': USER_AGENT}) as client:
        prefill(candidate, Reader(client, tmp_path, allowed=lambda url: True))
    assert calls == ['/robots.txt', '/', '/contact']
    assert candidate['phone'] == '(203) 555-0101' and candidate['hours'] == 'Monday 10AM-6PM'
    assert candidate['discogs_seller_name'] == 'fixture-seller' and candidate['verified'] == 'false'


def test_AC_01_robots_blocks_homepage_and_no_fake_seller(tmp_path):
    calls=[]
    def handler(request):
        calls.append(request.url.path)
        return httpx.Response(200, text='User-agent: *\nDisallow: /')
    candidate = row(website='https://shop.example/', verified='false')
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        prefill(candidate, Reader(client, tmp_path, allowed=lambda url: True))
    assert calls == ['/robots.txt'] and candidate['discogs_seller_name'] == ''
    assert 'not fetched' in candidate['notes']


def test_AC_01_private_hosts_rejected_before_network(monkeypatch):
    monkeypatch.setattr('scripts.shop_websites.socket.getaddrinfo', lambda *a, **kw: [(2, 1, 6, '', ('127.0.0.1', 443))])
    assert not public_url('https://shop.example/')
    assert not public_url('file:///etc/passwd')


def test_AC_01_inactive_store_is_not_scheduled_for_inventory(session):
    from app.inventory import drain_inventory
    store = Store(name='Closed fixture', active=False, lat=41, lng=-72, discogs_seller_name='fixture-closed')
    session.add(store)
    session.commit()
    class Queue:
        def __init__(self):
            self.session=session
        def inventory(self, *args):
            raise AssertionError('Inactive shop must not fetch inventory')
    drain_inventory(Queue(), now=lambda: NOW)
    assert store.inventory_next_sync is None


@pytest.mark.parametrize('status', ['closed', 'possibly closed'])
@pytest.mark.parametrize('verified', ['true', 'false'])
def test_AC_01_closed_directory_rows_never_activate(session, tmp_path, status, verified):
    path = tmp_path/'closed.csv'
    write_csv(path, [row(likely_status=status, verified=verified)])
    load_shops(session, path, include_unverified=True, now=NOW)
    store = session.scalar(select(Store))
    identifier = store.id
    assert not store.active
    # Confirmed closures also retire existing shops when unverified rows are skipped.
    store.active = True
    session.commit()
    load_shops(session, path, now=NOW)
    assert store.id == identifier and not store.active


def test_AC_01_closed_is_valid_and_unknown_status_is_rejected(tmp_path):
    from scripts.load_shops import read_csv
    path = tmp_path/'statuses.csv'
    write_csv(path, [row(likely_status='closed')])
    assert read_csv(path)[0]['likely_status'] == 'closed'
    write_csv(path, [row(likely_status='permanently-shuttered')])
    with pytest.raises(ValueError, match='likely_status'):
        read_csv(path)
