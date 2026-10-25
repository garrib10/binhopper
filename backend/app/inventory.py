"""Restricted marketplace cache: complete snapshots only; never exposed after six hours."""
from datetime import timedelta
from decimal import Decimal
import logging

from sqlalchemy import and_, or_, select, update

from app.models import Pressing, StockListing, Store, utcnow


def visible_inventory(now):
    return or_(StockListing.source != "discogs",
               and_(StockListing.discogs_listing_id.is_not(None),
                    StockListing.last_synced_at > now - timedelta(hours=6)))


def sync_store(queue, store, now=utcnow):
    # Finish fetching/validating before touching the previous snapshot. A failed
    # page must neither freshen old rows nor mark still-for-sale records sold.
    payloads = []
    page = 1
    while True:
        payload = queue.inventory(store.discogs_seller_name, page)
        pages = int(payload["pagination"]["pages"])
        if pages < page and not (page == 1 and pages == 0):
            raise ValueError("Invalid inventory pagination")
        payloads.extend(payload["listings"])
        if page >= pages:
            break
        page += 1
    records = {}
    for item in payloads:
        release = item["release"]
        if item.get("status") != "For Sale" or "vinyl" not in release.get("format", "").lower():
            continue
        # Prices are USD throughout v1. Do not mislabel another currency as USD.
        if item["price"]["currency"] != "USD":
            continue
        value = Decimal(str(item["price"]["value"]))
        quantity = int(item.get("quantity", 1))
        identifier = int(item["id"])
        if not value.is_finite() or value < 0 or value >= 1000000 or quantity < 1 or identifier < 1:
            raise ValueError("Invalid inventory listing")
        pressing = queue.session.scalar(select(Pressing).where(
            Pressing.discogs_release_id == int(release["id"])))
        if pressing is None:
            continue  # Unknown releases wait for the next CC0 import; no live gap calls.
        records[identifier] = (pressing.id, value, quantity, item["condition"])
    existing = queue.session.scalars(select(StockListing).where(
        StockListing.store_id == store.id, StockListing.source == "discogs")).all()
    by_id = {row.discogs_listing_id: row for row in existing}
    synced = now()
    for identifier, (pressing_id, price, quantity, condition) in records.items():
        row = by_id.get(identifier)
        if row is None:
            row = StockListing(store_id=store.id, discogs_listing_id=identifier, source="discogs")
            queue.session.add(row)
        row.pressing_id, row.price, row.quantity, row.condition = pressing_id, price, quantity, condition
        row.last_synced_at = synced
    for row in existing:
        if row.discogs_listing_id not in records:
            # Keep local report references, drop restricted price/condition data.
            row.quantity, row.price, row.condition = 0, 0, "Unavailable"
            row.last_synced_at = None
    store.inventory_next_sync = synced + timedelta(hours=4)
    queue.session.commit()


def drain_inventory(queue, now=utcnow):
    queue.session.execute(update(StockListing).where(
        StockListing.source == "discogs",
        or_(StockListing.last_synced_at.is_(None),
            StockListing.last_synced_at <= now() - timedelta(hours=6))
    ).values(quantity=0, price=0, condition="Unavailable"))
    stores = queue.session.scalars(select(Store).where(
        Store.discogs_seller_name.is_not(None), Store.discogs_seller_name != ""
    ).order_by(Store.id)).all()
    # Spread new shops over the coming four hours, retaining schedules on restart.
    new = [store for store in stores if store.inventory_next_sync is None]
    for index, store in enumerate(new):
        store.inventory_next_sync = now() + timedelta(seconds=index * 14400 / max(1, len(new)))
    queue.session.commit()
    for store in stores:
        if store.inventory_next_sync > now():
            continue
        try:
            sync_store(queue, store, now)
        except Exception:
            queue.session.rollback()
            store.inventory_next_sync = now() + timedelta(minutes=5)
            queue.session.commit()
            logging.getLogger(__name__).warning("Inventory sync failed for store %s; retry scheduled", store.id)
