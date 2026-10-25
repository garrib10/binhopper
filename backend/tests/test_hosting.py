import pytest
from sqlalchemy import func, select

from app.config import Settings
from app.models import Album, StockListing, Store, ZipCode
from scripts.seed_sample import load


@pytest.mark.parametrize("url,expected", [
    ("mysql://user:password@mysql/db", "mysql+pymysql://user:password@mysql/db"),
    ("mysql+pymysql://user@mysql/db", "mysql+pymysql://user@mysql/db"),
    ("sqlite://", "sqlite://"),
])
def test_database_url_driver(url, expected):
    assert Settings(_env_file=None, database_url=url).database_url == expected


def test_health_commit(client, monkeypatch):
    monkeypatch.delenv("RAILWAY_GIT_COMMIT_SHA", raising=False)
    assert client.get("/api/health").json() == {"status": "ok", "commit": "local"}
    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", "abc123")
    assert client.get("/api/health").json() == {"status": "ok", "commit": "abc123"}


def test_sample_seed_repeat_with_existing_zip(session):
    session.add(ZipCode(zip="10011", lat=40.7418, lng=-74.0040))
    session.commit()
    assert load(session)
    def counts():
        return [session.scalar(select(func.count()).select_from(model))
                for model in (Album, Store, StockListing, ZipCode)]
    before = counts()
    assert before == [1, 4, 4, 1]
    assert load(session) is False
    assert counts() == before
