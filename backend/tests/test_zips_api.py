"""Nearest ZIP for "Use my location" in onboarding (#43). Coordinates are never stored."""

import pytest
from sqlalchemy import func, select

from app.models import ZipCode


@pytest.fixture
def zips(session):
    session.add_all([ZipCode(zip="10011", lat=40.7418, lng=-74.0040),
                     ZipCode(zip="10003", lat=40.7317, lng=-73.9891),
                     ZipCode(zip="06037", lat=41.6081, lng=-72.7779)])
    session.commit()


def test_nearest_zip_to_a_location(client, zips):
    assert client.get("/api/zips/nearest", params={"lat": 40.743, "lng": -74.002}).json() == {"zip": "10011"}
    assert client.get("/api/zips/nearest", params={"lat": 40.73, "lng": -73.99}).json() == {"zip": "10003"}


def test_it_widens_the_search_for_rural_places(client, zips):
    # About 20 miles from Berlin, CT: no ZIP within 5 mi, found within 25 mi.
    assert client.get("/api/zips/nearest", params={"lat": 41.85, "lng": -72.6}).json() == {"zip": "06037"}


def test_nowhere_near_a_known_zip(client, zips):
    response = client.get("/api/zips/nearest", params={"lat": 47.6, "lng": -122.3})
    assert response.status_code == 404
    assert response.json()["detail"] == "We couldn't find a ZIP near you. Enter it instead."


@pytest.mark.parametrize("params", [{"lat": 91, "lng": 0}, {"lat": 0, "lng": 181}, {"lat": "x", "lng": 0}])
def test_bad_coordinates(client, zips, params):
    assert client.get("/api/zips/nearest", params=params).status_code == 422


def test_the_lookup_changes_nothing(client, zips, session):
    client.get("/api/zips/nearest", params={"lat": 40.743, "lng": -74.002})
    assert session.scalar(select(func.count()).select_from(ZipCode)) == 3
