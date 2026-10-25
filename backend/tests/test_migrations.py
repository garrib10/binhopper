"""The committed Alembic migrations build exactly the tables in app/models.py."""

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.config import settings
from app.db import Base

BACKEND = Path(__file__).resolve().parents[1]


def upgraded_engine(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    monkeypatch.setattr(settings, "database_url", url)  # migrations/env.py reads this
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    command.upgrade(cfg, "head")
    return create_engine(url), cfg


def test_upgrade_head_creates_every_table(tmp_path, monkeypatch):
    engine, _ = upgraded_engine(tmp_path, monkeypatch)
    tables = set(inspect(engine).get_table_names()) - {"alembic_version"}
    assert tables == set(Base.metadata.tables)


def test_models_have_no_unmigrated_changes(tmp_path, monkeypatch):
    engine, _ = upgraded_engine(tmp_path, monkeypatch)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], "models changed without a migration: run alembic revision --autogenerate"


def test_downgrade_base_removes_every_table(tmp_path, monkeypatch):
    engine, cfg = upgraded_engine(tmp_path, monkeypatch)
    command.downgrade(cfg, "base")
    assert set(inspect(engine).get_table_names()) <= {"alembic_version"}
