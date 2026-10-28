"""Test setup: a database session per test and a frozen clock.

By default each test gets a fresh in-memory SQLite database; the models avoid
MySQL-only types so the same tables work in both.

With TEST_DATABASE_URL set (the CI `integration` job), tests run against that
database instead. It must already be migrated (`alembic upgrade head`). Each test
runs inside a transaction that is rolled back afterwards; commits in app code
become savepoints, so tests never see each other's rows.
"""

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import mailer, passwords
from app.config import settings
from app.db import Base, get_session
from app.main import app
from app.routers.stock import get_now
from tests.helpers import NOW

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="session")
def integration_engine() -> Iterator[Engine]:
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture
def session(request) -> Iterator[Session]:
    if TEST_DATABASE_URL:
        engine = request.getfixturevalue("integration_engine")
        with engine.connect() as conn, conn.begin() as outer:
            with Session(bind=conn, expire_on_commit=False,
                         join_transaction_mode="create_savepoint") as s:
                yield s
            outer.rollback()
        return

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    with TestSession() as s:
        yield s


@pytest.fixture(autouse=True)
def fast_auth(monkeypatch):
    """Every test: cheap Argon2 parameters and emails kept in memory, never sent."""
    from argon2 import PasswordHasher

    cheap = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    monkeypatch.setattr(passwords, "hasher", cheap)
    monkeypatch.setattr(passwords, "DUMMY_HASH", cheap.hash("binhopper-no-such-account"))
    monkeypatch.setattr(settings, "email_backend", "memory")
    mailer.outbox.clear()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_now] = lambda: NOW
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def sign_in(client: TestClient, session: Session):
    """Sign the test client in as a new verified user: `user = sign_in("a@example.com")`.

    Calling it again switches the client to another user (the cookie is replaced).
    """
    from datetime import timedelta

    from app.models import User, UserSession, UserSettings
    from app.passwords import new_token, token_hash
    from app.sessions import COOKIE

    def as_user(email: str = "collector@example.com") -> User:
        user = User(username="collector-" + email.split("@")[0][:20], email=email,
                    email_verified_at=NOW, settings=UserSettings())
        session.add(user)
        session.flush()
        token = new_token()
        session.add(UserSession(user_id=user.id, token_hash=token_hash(token), created_at=NOW,
                                expires_at=NOW + timedelta(days=30), last_seen_at=NOW))
        session.commit()
        client.cookies.set(COOKIE, token)
        client.headers["X-Binhopper-CSRF"] = "1"
        return user

    return as_user
