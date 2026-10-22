"""Distance and radius math for the nearby-stock search.

Distances are straight-line (great-circle) miles from the ZIP's center point
to the store, per SPEC.md › Nearby stock rule 2.
"""

import math

EARTH_RADIUS_MI = 3958.7613
ALLOWED_RADII_MI = (10, 25, 50, 100)


def haversine_mi(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in miles between two lat/lng points."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(a))


def within_radius(distance_mi: float, radius_mi: float) -> bool:
    """A store exactly on the edge counts as inside (AC-02)."""
    return distance_mi <= radius_mi + 1e-9


def bounding_box(lat: float, lng: float, radius_mi: float) -> tuple[float, float, float, float]:
    """A lat/lng box that fully contains the radius circle.

    Used as a cheap, index-friendly first filter in SQL before the exact
    distance check. Returns (min_lat, max_lat, min_lng, max_lng).
    """
    dlat = math.degrees(radius_mi / EARTH_RADIUS_MI)
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    dlng = math.degrees(radius_mi / (EARTH_RADIUS_MI * cos_lat))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def display_miles(distance_mi: float) -> float:
    """Distances are shown rounded to one decimal place."""
    return round(distance_mi, 1)
