"""Shared test constants and helpers (no app or database imports)."""

import math
import re
from datetime import UTC, datetime

from app.geo import EARTH_RADIUS_MI

# The app stores naive UTC times, so the frozen test clock is naive UTC too.
NOW = datetime(2026, 10, 22, 12, 0, 0, tzinfo=UTC).replace(tzinfo=None)
ZIP_10011 = (40.7418, -74.0040)


def point_north(lat: float, lng: float, miles: float) -> tuple[float, float]:
    """A point exactly `miles` due north: distance along a meridian is exact."""
    return lat + math.degrees(miles / EARTH_RADIUS_MI), lng


def link_token(message: dict[str, str]) -> str:
    """The token from an emailed link (it sits in the URL fragment: /verify#token=…)."""
    return re.search(r"#token=([\w-]+)", message["text"]).group(1)
