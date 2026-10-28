import configparser
import re
import tomllib
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.db import connect_when_ready, connect_with_retry, wait_for_server_on_connect
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


BACKEND = Path(__file__).resolve().parents[1]


def test_railway_requirements_match_pyproject():
    # Railpack installs from requirements.txt only; a missing or stale copy means
    # Railway builds an image without alembic/uvicorn and the deploy fails.
    pyproject = tomllib.loads((BACKEND / "pyproject.toml").read_text())
    lines = (BACKEND / "requirements.txt").read_text().splitlines()
    required = [line.strip() for line in lines if line.strip() and not line.startswith("#")]
    assert required == pyproject["project"]["dependencies"]


def test_railway_python_version_matches_ci():
    version = (BACKEND / ".python-version").read_text().strip()
    ci = (BACKEND.parent / ".github" / "workflows" / "ci.yml").read_text()
    assert set(re.findall(r'python-version: "([\d.]+)"', ci)) == {version}


def test_alembic_finds_app_without_the_package_installed():
    config = configparser.ConfigParser()
    config.read(BACKEND / "alembic.ini")
    assert config["alembic"]["prepend_sys_path"] == "."


class FakeEngine:
    """Refuses the first `failures` connections, like a sleeping MySQL waking up."""

    def __init__(self, failures):
        self.failures, self.attempts = failures, 0

    def connect(self):
        self.attempts += 1
        if self.attempts <= self.failures:
            raise OperationalError("connect", None, Exception("(2003, 'Connection refused')"))
        return "connection"


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def test_migrations_wait_for_a_waking_database():
    engine, clock = FakeEngine(failures=3), FakeClock()
    assert connect_with_retry(engine, timeout=120, interval=3, sleep=clock.sleep, clock=clock) == "connection"
    assert engine.attempts == 4
    assert clock.now == 9


def test_migrations_give_up_after_the_timeout():
    engine, clock = FakeEngine(failures=1000), FakeClock()
    with pytest.raises(OperationalError):
        connect_with_retry(engine, timeout=120, interval=3, sleep=clock.sleep, clock=clock)
    assert clock.now <= 120
    assert engine.attempts == 41


def test_migrations_connect_at_once_when_the_database_is_up():
    with connect_with_retry(create_engine("sqlite://"), sleep=pytest.fail) as connection:
        assert connection.exec_driver_sql("select 1").scalar() == 1


class FakeDBAPI:
    """A MySQL driver whose connect() raises the given error codes, then succeeds."""

    class OperationalError(Exception):
        pass

    def __init__(self, *codes):
        self.codes, self.calls = list(codes), 0

    def connect(self, *args, **kwargs):
        self.calls += 1
        if self.codes:
            raise self.OperationalError(self.codes.pop(0), "MySQL says no")
        return "dbapi-connection"


def test_requests_wait_for_mysql_to_wake():  # #132
    dbapi, clock = FakeDBAPI(2003, 2003, 2013), FakeClock()
    assert connect_when_ready(dbapi, (), {}, timeout=20, interval=1,
                              sleep=clock.sleep, clock=clock) == "dbapi-connection"
    assert (dbapi.calls, clock.now) == (4, 3)


def test_other_connection_errors_fail_at_once():
    dbapi, clock = FakeDBAPI(1045), FakeClock()  # access denied: retrying won't help
    with pytest.raises(FakeDBAPI.OperationalError):
        connect_when_ready(dbapi, (), {}, sleep=clock.sleep, clock=clock)
    assert dbapi.calls == 1


def test_request_wait_is_capped():
    dbapi, clock = FakeDBAPI(*[2003] * 100), FakeClock()
    with pytest.raises(FakeDBAPI.OperationalError):
        connect_when_ready(dbapi, (), {}, timeout=20, interval=1, sleep=clock.sleep, clock=clock)
    assert (dbapi.calls, clock.now) == (21, 20)


def test_mysql_engine_retries_a_refused_connection(capsys):
    # A real pymysql connect to a closed local port: refused (2003), retried, then raised.
    engine = create_engine("mysql+pymysql://user:pw@127.0.0.1:9/db")
    wait_for_server_on_connect(engine, timeout=1.0, interval=0.1)
    with pytest.raises(OperationalError, match="2003"):
        engine.connect()
    assert "Database not ready" in capsys.readouterr().err  # the do_connect hook retried
