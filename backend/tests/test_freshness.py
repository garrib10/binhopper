from datetime import timedelta

from app.freshness import Freshness, classify
from tests.helpers import NOW


def test_verified_in_last_24h():
    assert classify(NOW, NOW - timedelta(days=3), NOW - timedelta(hours=5)) == Freshness.VERIFIED


def test_recent_sync_is_current():
    assert classify(NOW, NOW - timedelta(hours=10), None) == Freshness.CURRENT


def test_exactly_seven_days_is_still_current():
    assert classify(NOW, NOW - timedelta(days=7), None) == Freshness.CURRENT


def test_older_than_seven_days_is_out_of_date():  # AC-05
    assert classify(NOW, NOW - timedelta(days=8), None) == Freshness.OUT_OF_DATE


def test_never_synced_is_out_of_date():
    assert classify(NOW, None, None) == Freshness.OUT_OF_DATE


def test_two_missing_reports_override_everything():  # AC-06
    assert classify(NOW, NOW, NOW, missing_reports_24h=2) == Freshness.REPORTED_MISSING


def test_one_missing_report_is_not_enough():
    assert classify(NOW, NOW - timedelta(hours=1), None, missing_reports_24h=1) == Freshness.CURRENT
