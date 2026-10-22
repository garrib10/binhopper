"""ZIP loader (scripts/load_zip_codes.py), run against small fixture files only."""

from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.models import ZipCode
from scripts.load_zip_codes import load_zip_codes

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "gazetteer_zcta_sample.txt"


def zip_count(session) -> int:
    return session.scalar(select(func.count()).select_from(ZipCode))


def test_loads_every_zip_in_the_file(session):
    assert load_zip_codes(session, SAMPLE) == 3
    assert zip_count(session) == 3
    row = session.get(ZipCode, "06010")
    assert (row.lat, row.lng) == (41.681578, -72.940749)


def test_rerun_updates_without_duplicates(session):
    session.add(ZipCode(zip="10011", lat=0.0, lng=0.0))
    session.commit()

    load_zip_codes(session, SAMPLE)
    load_zip_codes(session, SAMPLE)

    assert zip_count(session) == 3
    session.expire_all()
    assert session.get(ZipCode, "10011").lat == pytest.approx(40.741776)


def test_reads_older_tab_separated_files(session):
    load_zip_codes(session, FIXTURES / "gazetteer_zcta_sample_tabs.txt")
    assert session.get(ZipCode, "06010").lng == pytest.approx(-72.940749)
