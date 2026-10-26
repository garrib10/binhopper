"""Load an authoritative shop CSV; default to verified rows; soft-retire absent shops."""
import argparse
import csv
from datetime import datetime
import math
from pathlib import Path
import re
from urllib.parse import urlsplit

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Store, utcnow
from scripts.build_shop_candidates import COLUMNS

STATUSES = {'record shop', 'instruments only', 'possibly closed', 'unknown'}
LIMITS = {'shop_key': 255, 'osm_id': 40, 'name': 255, 'address': 255, 'town': 120,
          'phone': 40, 'website': 500, 'discogs_seller_name': 120}


def read_csv(path):
    with path.open(newline='', encoding='utf-8-sig') as source:
        reader = csv.DictReader(source)
        if reader.fieldnames != COLUMNS:
            raise ValueError('CSV columns must exactly match the documented shop schema')
        rows = []
        keys, ids, sellers = set(), set(), set()
        for number, raw in enumerate(reader, 2):
            if None in raw or any(value is None for value in raw.values()):
                raise ValueError(f'Row {number}: malformed CSV row')
            row = {key: value.strip() for key, value in raw.items()}
            for field, limit in LIMITS.items():
                if len(row[field]) > limit:
                    raise ValueError(f'Row {number}: {field} exceeds {limit} characters')
            key = row['shop_key']
            if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', key) or key in keys:
                raise ValueError(f'Row {number}: invalid/duplicate shop_key')
            keys.add(key)
            if row['osm_id']:
                if not re.fullmatch(r'(node|way|relation)/[1-9]\d*', row['osm_id']) or row['osm_id'] in ids:
                    raise ValueError(f'Row {number}: invalid/duplicate osm_id')
                ids.add(row['osm_id'])
            seller = row['discogs_seller_name']
            if seller:
                if seller.casefold() in sellers or re.search(r'[\s/\\]', seller):
                    raise ValueError(f'Row {number}: invalid/duplicate seller name')
                sellers.add(seller.casefold())
            if row['verified'].lower() not in {'true', 'false'} or row['likely_status'] not in STATUSES:
                raise ValueError(f'Row {number}: invalid verified/likely_status value')
            row['verified'] = row['verified'].lower() == 'true'
            if row['website']:
                url = urlsplit(row['website'])
                if url.scheme not in {'http', 'https'} or not url.hostname or url.username or url.password:
                    raise ValueError(f'Row {number}: invalid website URL')
            if not row['osm_id'] and not re.search('not from OSM', row['notes'], re.I):
                raise ValueError(f'Row {number}: hand-added rows must note "not from OSM"')
            # Missing coordinates are allowed in unverified candidates, not loaded stores.
            for field, limit in [('lat', 90), ('lng', 180)]:
                if row[field]:
                    value = float(row[field])
                    if not math.isfinite(value) or not -limit <= value <= limit:
                        raise ValueError(f'Row {number}: invalid {field}')
            rows.append(row)
    if not rows:
        raise ValueError('Refusing an empty authoritative CSV; retain closed rows to retire all shops explicitly')
    return rows


def load_shops(session, path, *, include_unverified=False, now: datetime | None = None):
    rows = read_csv(path)  # Validate the WHOLE file before changing any store.
    now = now or utcnow()
    stores = session.scalars(select(Store)).all()
    by_key = {store.shop_key: store for store in stores}
    by_osm = {store.osm_id: store for store in stores if store.osm_id}
    present = {row['shop_key'] for row in rows}
    loaded = 0
    try:
        for row in rows:
            store = by_key.get(row['shop_key'])
            owner = by_osm.get(row['osm_id']) if row['osm_id'] else None
            if owner is not None and owner is not store:
                raise ValueError('osm_id already belongs to another shop_key; preserve the stable key when editing names/towns')
            if row['likely_status'] == 'possibly closed' and store:
                store.active = False
            if not row['verified'] and not include_unverified:
                continue
            if not row['name'] or not row['lat'] or not row['lng']:
                raise ValueError(f"{row['shop_key']}: name and coordinates are required for loaded rows")
            if store is None:
                store = Store(shop_key=row['shop_key'])
                session.add(store)
            for field in ['name', 'address', 'phone', 'website', 'osm_id', 'discogs_seller_name']:
                setattr(store, field, row[field] or None)
            store.area = row['town'] or None
            store.lat, store.lng = float(row['lat']), float(row['lng'])
            store.hours = {'text': row['hours']} if row['hours'] else None
            store.source = 'manual'
            store.active = row['likely_status'] != 'possibly closed'
            store.verified_at = now if row['verified'] else None
            loaded += 1
        # CSV is a COMPLETE directory, not a regional append/patch. Never delete history.
        for store in stores:
            if store.shop_key not in present:
                store.active = False
        session.commit()
    except Exception:
        session.rollback()
        raise
    return loaded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path', type=Path)
    parser.add_argument('--include-unverified', action='store_true')
    args = parser.parse_args()
    with SessionLocal() as session:
        count = load_shops(session, args.path, include_unverified=args.include_unverified)
    print(f'Loaded {count} shops; absent/closed shops deactivated, never deleted.')


if __name__ == '__main__':
    main()
