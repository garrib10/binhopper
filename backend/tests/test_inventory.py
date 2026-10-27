"""AC-05/06 inventory expiry and AC-16 shared seller quota; all HTTP mocked."""
from datetime import timedelta
import httpx
import pytest
from sqlalchemy import select
from app.discogs import RequestQueue
from app.inventory import drain_inventory, sync_store
from app.models import Album, Artist, Pressing, StockListing, Store, ZipCode
from tests.helpers import NOW, ZIP_10011
from tests.test_catalog_import import Clock

@pytest.fixture
def inventory(session):
    artist = Artist(name="Fixture artist")
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title="Fixture album")
    session.add(album)
    session.flush()
    pressing = Pressing(album_id=album.id, discogs_release_id=123)
    store = Store(name="Fixture shop", lat=ZIP_10011[0], lng=ZIP_10011[1], discogs_seller_name="fixture.seller")
    session.add_all([pressing, store, ZipCode(zip="10011", lat=ZIP_10011[0], lng=ZIP_10011[1])])
    session.commit()
    return store, pressing


def listing(identifier, **changes):
    return {"id": identifier, "status": "For Sale", "release": {"id": 123, "format": "Vinyl, LP"},
            "price": {"currency": "USD", "value": 24.5}, "condition": "VG+", "quantity": 2, **changes}


def queue_for(session, handler, clock=None):
    clock = clock or Clock()
    return RequestQueue(session, "test-only", "Binhopper/test", now=clock.now, sleep=clock.sleep,
                        transport=httpx.MockTransport(handler))


def test_AC_16_paginated_snapshot_matching_removal_and_repeat(session, inventory):
    store, pressing = inventory
    session.add(StockListing(store_id=store.id, pressing_id=pressing.id, source="manual", price=17,
                             condition="New", quantity=1))
    calls = []
    def handler(request):
        calls.append(int(request.url.params['page']))
        assert request.url.params['status'] == 'For Sale'
        rows = ([listing(1), listing(2, release={"id": 999, "format": "Vinyl"})] if calls[-1] == 1
                else [listing(3), listing(4, release={"id": 123, "format": "CD"}),
                      listing(5, status="Draft"), listing(6, price={"currency": "EUR", "value": 2})])
        return httpx.Response(200, json={"pagination": {"pages": 2}, "listings": rows})
    queue = queue_for(session, handler)
    sync_store(queue, store, now=lambda: NOW)
    sync_store(queue, store, now=lambda: NOW)
    rows = session.scalars(select(StockListing).where(StockListing.source == "discogs")).all()
    assert {r.discogs_listing_id for r in rows} == {1, 3}
    assert all(r.quantity == 2 and float(r.price) == 24.5 and r.last_synced_at == NOW for r in rows)
    assert calls == [1, 2, 1, 2]
    queue.close()
    queue = queue_for(session, lambda request: httpx.Response(200, json={"pagination": {"pages": 0}, "listings": []}))
    sync_store(queue, store, now=lambda: NOW)
    assert all(r.quantity == 0 and r.price == 0 for r in rows)
    assert session.scalar(select(StockListing).where(StockListing.source == "manual")).quantity == 1
    queue.close()


def test_AC_16_failed_page_does_not_publish_partial_snapshot(session, inventory):
    store, pressing = inventory
    row = StockListing(store_id=store.id, pressing_id=pressing.id, source="discogs", discogs_listing_id=77,
                       price=10, condition="NM", quantity=1, last_synced_at=NOW-timedelta(hours=1))
    session.add(row)
    session.commit()
    def handler(request):
        return (httpx.Response(200, json={"pagination": {"pages": 2}, "listings": [listing(1)]})
                if request.url.params['page'] == '1' else httpx.Response(503))
    queue = queue_for(session, handler)
    with pytest.raises(httpx.HTTPStatusError):
        sync_store(queue, store, now=lambda: NOW)
    assert row.quantity == 1 and row.last_synced_at == NOW-timedelta(hours=1)
    assert session.scalar(select(StockListing).where(StockListing.discogs_listing_id == 1)) is None
    queue.close()


@pytest.mark.parametrize('age,visible', [(timedelta(hours=5, minutes=59), True), (timedelta(hours=6), False),
                                       (timedelta(hours=7), False)])
def test_AC_05_AC_06_discogs_cutoff_even_when_verified(client, session, inventory, age, visible):
    store, pressing = inventory
    session.add(StockListing(store_id=store.id, pressing_id=pressing.id, source="discogs", discogs_listing_id=12,
                            price=15, condition="VG+", quantity=1, last_synced_at=NOW-age, last_verified_at=NOW))
    session.commit()
    stores = client.get(f'/api/albums/{pressing.album_id}/stock?zip=10011').json()['stores']
    assert bool(stores) == visible
    if visible:
        assert stores[0]['discogs_url'] == 'https://www.discogs.com/sell/item/12'
    result = client.get('/api/search?q=Fixture&zip=10011&radius=25').json()
    assert result['albums'][0]['store_count'] == int(visible)


def test_AC_16_100_sellers_and_catalog_share_rolling_quota(session):
    clock, calls = Clock(), []
    def handler(request):
        calls.append(clock.now())
        return httpx.Response(200, json={"pagination": {"pages": 0}, "listings": []})
    stores = [Store(name=f'Fixture {i}', lat=0, lng=0, discogs_seller_name=f'fixture{i}') for i in range(100)]
    session.add_all(stores)
    session.commit()
    queue = queue_for(session, handler, clock)
    for store in stores:
        sync_store(queue, store, now=clock.now)
    queue.get('artists', 1)
    assert len(calls) == 101
    for start in calls:
        assert sum(start <= t < start+timedelta(seconds=60) for t in calls) <= 60
    queue.close()


def test_AC_16_staggered_schedule_is_durable_and_expired_cache_scrubbed(session, inventory):
    store, pressing = inventory
    second = Store(name='Second fixture', lat=0, lng=0, discogs_seller_name='fixture-second')
    expired = StockListing(store_id=store.id, pressing_id=pressing.id, source='discogs', price=25,
                           quantity=1, condition='NM', last_synced_at=NOW-timedelta(hours=7))
    session.add_all([second, expired])
    session.commit()
    queue = queue_for(session, lambda request: httpx.Response(503))
    drain_inventory(queue, now=lambda: NOW)
    assert store.inventory_next_sync == NOW+timedelta(minutes=5)
    assert second.inventory_next_sync == NOW+timedelta(hours=2)
    assert expired.quantity == 0 and expired.price == 0
    drain_inventory(queue, now=lambda: NOW)
    assert second.inventory_next_sync == NOW+timedelta(hours=2)
    queue.close()
