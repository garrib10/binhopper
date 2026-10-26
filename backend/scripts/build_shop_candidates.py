"""Build unverified shop candidates from cached OSM JSON/PBF; network is opt-in."""
import argparse
from collections import Counter
import csv
import json
from pathlib import Path
import re
import unicodedata

COLUMNS = ['shop_key', 'osm_id', 'name', 'address', 'town', 'lat', 'lng', 'phone',
           'website', 'hours', 'discogs_seller_name', 'likely_status', 'verified', 'notes']


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')


def matches(tags):
    return (tags.get('shop') == 'music' or re.search('vinyl|records', tags.get('music', ''))
            or ('shop' in tags and re.search('record|vinyl', tags.get('name', ''), re.I)))


def classify(tags):
    if any(key in tags for key in ('disused:shop', 'abandoned:shop', 'end_date')) or tags.get('shop') in {'closed', 'vacant'}:
        return 'possibly closed', 'OSM lifecycle/closure tag; confirm current operation.'
    if re.search('record|vinyl', tags.get('name', ''), re.I) or re.search('vinyl|records', tags.get('music', '')):
        return 'record shop', 'OSM name/music tag mentions records or vinyl; not verified.'
    if tags.get('shop') == 'musical_instrument' or re.search('instrument|guitar|piano', tags.get('music', ''), re.I):
        return 'instruments only', 'OSM indicates instruments; vinyl sales not established.'
    return 'unknown', 'OSM shop=music alone does not establish vinyl sales.'


def candidate(element):
    tags = element['tags']
    center = element.get('center', element)
    town = tags.get('addr:city', tags.get('addr:town', tags.get('addr:village', '')))
    status, note = classify(tags)
    if tags.get('shop') not in {None, 'music', 'musical_instrument'}:
        note += f" OSM shop={tags['shop']} conflicts with the music-name match; verify."
    street = ' '.join(filter(None, [tags.get('addr:housenumber'), tags.get('addr:street')]))
    address = tags.get('addr:full', street)
    if not tags.get('addr:full') and tags.get('addr:unit'):
        address = f"{address}, Unit {tags['addr:unit']}".strip(', ')
    return dict(zip(COLUMNS, [slug(f"{tags.get('name', '')} {town}") or f"unnamed-{element['type']}-{element['id']}",
        f"{element['type']}/{element['id']}", tags.get('name', ''), address, town,
        center.get('lat', ''), center.get('lon', ''), tags.get('contact:phone', tags.get('phone', '')),
        tags.get('contact:website', tags.get('website', '')), tags.get('opening_hours', ''), '',
        status, 'false', note], strict=True))


def read_pbf(path):
    try:
        import osmium
    except ImportError as error:
        raise RuntimeError('PBF input requires: pip install -e ".[shops]"') from error
    rows = {}
    def add(kind, identifier, tags, points):
        if not matches(tags):
            return
        center = ({'lat': (min(p[0] for p in points)+max(p[0] for p in points))/2,
                   'lon': (min(p[1] for p in points)+max(p[1] for p in points))/2} if points else {})
        rows[f'{kind}/{identifier}'] = {'type': kind, 'id': identifier, 'tags': tags, 'center': center}
    class Handler(osmium.SimpleHandler):
        def node(self, node):
            tags = dict(node.tags)
            if matches(tags):
                add('node', node.id, tags, [(node.location.lat, node.location.lon)])
        def way(self, way):
            tags = dict(way.tags)
            if matches(tags):
                points = [(n.lat, n.lon) for n in way.nodes if n.location.valid()]
                add('way', way.id, tags, points)
        def relation(self, relation):
            tags = dict(relation.tags)
            if matches(tags):
                add('relation', relation.id, tags, [])
        def area(self, area):
            if not area.from_way() and matches(dict(area.tags)):
                add('relation', area.orig_id(), dict(area.tags),
                    [(n.lat, n.lon) for ring in area.outer_rings() for n in ring if n.location.valid()])
    Handler().apply_file(str(path), locations=True, idx='flex_mem')
    return list(rows.values())


def build(path):
    if path.suffix == '.pbf':
        elements = read_pbf(path)
    else:
        payload = json.loads(path.read_text())
        if payload.get('remark'):
            raise ValueError('Overpass returned an incomplete/error response')
        elements = payload['elements']
    # OSM IDs remain distinct; do not silently collapse separate locations.
    rows = {f"{e['type']}/{e['id']}": candidate(e) for e in elements if matches(e.get('tags', {}))}
    counts = Counter(row['shop_key'] for row in rows.values())
    names = Counter(row['name'].casefold() for row in rows.values() if row['name'])
    for row in rows.values():
        if counts[row['shop_key']] > 1:
            row['shop_key'] += '-' + row['osm_id'].replace('/', '-')
            row['notes'] += ' Duplicate name/town key; OSM ID suffix distinguishes candidates.'
        if row['name'] and names[row['name'].casefold()] > 1:
            row['notes'] += ' Same name appears on multiple OSM objects; check for duplicate/relocated shop.'
        if not row['name'] or row['lat'] == '' or row['lng'] == '':
            row['notes'] += ' Missing name/coordinates: complete before loading.'
    return sorted(rows.values(), key=lambda row: (row['name'].casefold(), row['osm_id']))


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as out:
        writer = csv.DictWriter(out, fieldnames=COLUMNS, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path, default=Path('../data/shops/connecticut.csv'))
    parser.add_argument('--prefill-websites', action='store_true', help='Explicit live website reads, never in CI')
    parser.add_argument('--cache-dir', type=Path, default=Path('../data/raw/websites'))
    args = parser.parse_args()
    rows = build(args.input)
    if args.prefill_websites:
        from scripts.shop_websites import prefill_all
        prefill_all(rows, args.cache_dir)
    write_csv(args.output, rows)
    print(f'Wrote {len(rows)} unverified candidates to {args.output}')


if __name__ == '__main__':
    main()
