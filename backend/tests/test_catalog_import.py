import gzip
from pathlib import Path
from datetime import timedelta

import httpx
import pytest
from sqlalchemy import func, select

from app.catalog_refresh import apply_response, expire, fresh
from app.discogs import RequestQueue, enqueue
from app.models import Album, Artist, DiscogsCall, Pressing
from app.worker import drain
from scripts.import_discogs_dump import import_path
from tests.helpers import NOW

SAMPLE = Path(__file__).parent / 'fixtures/discogs_cc0'


def test_real_cc0_sample_is_repeatable_and_never_needs_network(session, tmp_path):
    for file in SAMPLE.glob('*.xml'):
        (tmp_path / (file.name + '.gz')).write_bytes(gzip.compress(file.read_bytes()))
    assert import_path(session, tmp_path) == {'artists': 21, 'masters': 30, 'releases': 30}
    def counts():
        return [session.scalar(select(func.count()).select_from(m)) for m in (Artist, Album, Pressing)]
    before = counts()
    assert before == [21, 30, 30]
    import_path(session, tmp_path)
    assert counts() == before
    pressing = session.scalar(select(Pressing))
    assert pressing.discogs_release_id and pressing.label and pressing.variant_note
    assert session.scalar(select(Album)).tracklist
    assert session.scalar(select(Artist)).name


def test_limit_and_vinyl_only(session):
    result = import_path(session, SAMPLE, limit=2)
    assert result == {'artists': 2, 'masters': 2, 'releases': 2}
    assert all(p.format in {'Vinyl', 'LP'} for p in session.scalars(select(Pressing)))


class Clock:
    def __init__(self):
        self.time = NOW
    def now(self):
        return self.time
    def sleep(self, seconds):
        self.time += timedelta(seconds=seconds)


def test_AC_16_100_queued_jobs_never_exceed_60_per_rolling_minute(session):  # AC-16
    clock, calls = Clock(), []
    def fake(request):
        calls.append(clock.now())
        assert request.headers['User-Agent'].startswith('Binhopper')
        assert request.headers['Authorization'] == 'Discogs token=test-only'
        return httpx.Response(200, json={'id': int(request.url.path.split('/')[-1]), 'name': 'Fixture artist'},
                              headers={'X-Discogs-Ratelimit': '60', 'X-Discogs-Ratelimit-Remaining': '59',
                                       'X-Discogs-Ratelimit-Used': '1'})
    for identifier in range(1, 101):
        enqueue(session, 'artists', identifier, now=clock.now)
    queue = RequestQueue(session, 'test-only', 'Binhopper/test', transport=httpx.MockTransport(fake),
                         now=clock.now, sleep=clock.sleep)
    try:
        drain(queue, now=clock.now)
    finally:
        queue.close()
    assert len(calls) == 100
    for start in calls:
        assert sum(start <= t < start + timedelta(seconds=60) for t in calls) <= 60
    assert clock.now() > NOW + timedelta(seconds=60)
    # Reservations remain durable across worker reconstruction/restarts.
    assert session.scalar(select(func.count()).select_from(DiscogsCall)) > 0


def test_api_provenance_expires_without_erasing_cc0_or_foreign_keys(session):
    import_path(session, SAMPLE, limit=1)
    durable = session.scalar(select(Album))
    durable.cover_url, durable.cover_fetched_at = 'https://i.discogs.com/cover.jpg', NOW
    row = apply_response(session, 'masters', {'id': 99999999, 'title': 'API gap', 'year': 2026,
        'artists': [{'id': 99999999, 'name': 'Gap artist'}], 'tracklist': [{'position': 'A1', 'title': 'Gap track'}],
        'images': [{'uri': 'https://i.discogs.com/gap.jpg'}]}, NOW)
    session.commit()
    assert row.api_fetched_at == NOW and row.cover_fetched_at == NOW
    assert fresh(row, NOW + timedelta(hours=5))
    assert not fresh(row, NOW + timedelta(hours=6))
    expire(session, NOW + timedelta(hours=6))
    assert row.title == 'Unavailable album' and row.cover_url is None and row.tracklist == []
    assert durable.title != 'Unavailable album' and durable.cover_url is None
    assert session.get(Album, row.id) is row


def test_headers_lower_quota_and_429_do_not_retry_without_waiting(session):
    clock = Clock()
    queue = RequestQueue(session, 'test-only', 'Binhopper/test', now=clock.now, sleep=clock.sleep,
        transport=httpx.MockTransport(lambda request: httpx.Response(429, headers={
            'X-Discogs-Ratelimit': '25', 'X-Discogs-Ratelimit-Remaining': '0',
            'X-Discogs-Ratelimit-Used': '25'})))
    try:
        with pytest.raises(httpx.HTTPStatusError):
            queue.get('artists', 1)
        assert queue.limit == 25 and queue.remaining == 0
        assert clock.now() > NOW + timedelta(seconds=60)
    finally:
        queue.close()


def test_release_formats_skip_cd_and_keep_explicit_exclusive_badges(session):
    from xml.etree import ElementTree as ET
    from scripts.import_discogs_dump import release
    import_path(session, SAMPLE, limit=1)
    node = ET.fromstring((SAMPLE / 'releases.xml').read_bytes())[0]
    before = session.scalar(select(func.count()).select_from(Pressing))
    for fmt in node.findall('formats/format'):
        fmt.set('name', 'CD')
    assert release(session, node) is False
    assert session.scalar(select(func.count()).select_from(Pressing)) == before
    fmt = node.find('formats/format')
    fmt.set('name', 'Vinyl')
    ET.SubElement(fmt.find('descriptions'), 'description').text = 'Artist Store Exclusive'
    assert release(session, node)
    pressing = session.scalar(select(Pressing).where(Pressing.discogs_release_id == int(node.get('id'))))
    assert pressing.exclusive_kind == 'artist'
    assert 'Artist Store Exclusive' in pressing.variant_note


def test_expired_gap_album_is_hidden_even_when_worker_is_down(client, session):
    row = apply_response(session, 'masters', {'id': 99999998, 'title': 'Stale gap',
        'artists': [{'id': 99999998, 'name': 'Gap artist'}]}, NOW - timedelta(hours=6))
    session.commit()
    assert client.get(f'/api/albums/{row.id}/stock?zip=10011&radius=25').status_code == 404
