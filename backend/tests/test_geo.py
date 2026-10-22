from app.geo import bounding_box, display_miles, haversine_mi, within_radius
from tests.helpers import ZIP_10011, point_north


def test_known_distance_nyc_to_philadelphia():
    # City-hall to city-hall is about 80 miles in a straight line.
    d = haversine_mi(40.7128, -74.0060, 39.9526, -75.1652)
    assert 79 < d < 82


def test_point_north_is_exact_distance():
    lat, lng = point_north(*ZIP_10011, 25)
    assert abs(haversine_mi(*ZIP_10011, lat, lng) - 25) < 1e-6


def test_store_exactly_on_radius_is_included():  # AC-02
    assert within_radius(25.0, 25)
    assert not within_radius(25.01, 25)


def test_bounding_box_contains_the_whole_circle():
    lat0, lng0 = ZIP_10011
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat0, lng0, 25)
    north_lat, _ = point_north(lat0, lng0, 25)
    assert min_lat < lat0 < north_lat <= max_lat + 1e-9
    assert min_lng < lng0 < max_lng


def test_display_rounds_to_one_decimal():
    assert display_miles(3.24) == 3.2
    assert display_miles(8.75) == 8.8
