import configparser
import re
import tomllib
from pathlib import Path

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
