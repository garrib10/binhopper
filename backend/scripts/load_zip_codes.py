"""Load US ZIP code center points into zip_codes.

Source: the US Census Bureau ZCTA Gazetteer file (public domain), e.g.
https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
Download and unzip it yourself; this script only reads the file it is given.

ZCTAs cover ZIPs that have street addresses. PO-box-only ZIPs are not in the file.

Safe to re-run: existing ZIPs are updated in place, not duplicated.

Run from backend/:  python -m scripts.load_zip_codes path/to/2026_Gaz_zcta_national.txt
"""

import argparse
import csv
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import ZipCode

BATCH_SIZE = 2000


def read_gazetteer(path: Path) -> Iterator[dict]:
    """Yield {zip, lat, lng} rows. Newer files use "|" between columns, older ones tabs."""
    with path.open(newline="", encoding="utf-8") as f:
        header = f.readline()
        delimiter = "|" if "|" in header else "\t"
        columns = [c.strip() for c in header.split(delimiter)]
        for fields in csv.reader(f, delimiter=delimiter):
            if not fields:
                continue
            row = dict(zip(columns, (v.strip() for v in fields), strict=False))
            yield {"zip": row["GEOID"], "lat": float(row["INTPTLAT"]), "lng": float(row["INTPTLONG"])}


def upsert(session: Session, rows: list[dict]) -> None:
    """Insert rows, or update lat/lng when the ZIP is already there (MySQL or SQLite)."""
    dialect = session.get_bind().dialect.name
    if dialect == "mysql":
        stmt = mysql_insert(ZipCode).values(rows)
        stmt = stmt.on_duplicate_key_update(lat=stmt.inserted.lat, lng=stmt.inserted.lng)
    elif dialect == "sqlite":
        stmt = sqlite_insert(ZipCode).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=[ZipCode.zip], set_={"lat": stmt.excluded.lat, "lng": stmt.excluded.lng}
        )
    else:
        raise RuntimeError(f"Unsupported database: {dialect}")
    session.execute(stmt)


def load_zip_codes(session: Session, path: Path) -> int:
    """Load every ZIP in the file and commit. Returns how many rows were read."""
    count = 0
    batch: list[dict] = []
    for row in read_gazetteer(path):
        batch.append(row)
        if len(batch) == BATCH_SIZE:
            upsert(session, batch)
            count += len(batch)
            batch = []
    if batch:
        upsert(session, batch)
        count += len(batch)
    session.commit()
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("path", type=Path, help="Unzipped Gazetteer ZCTA file (.txt)")
    args = parser.parse_args()

    with SessionLocal() as s:
        count = load_zip_codes(s, args.path)
    print(f"Loaded {count} ZIP codes.")


if __name__ == "__main__":
    main()
