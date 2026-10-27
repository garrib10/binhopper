import sys
import time
from collections.abc import Callable, Iterator

from sqlalchemy import Connection, Engine, create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def connect_with_retry(
    engine: Engine,
    timeout: float = 120.0,
    interval: float = 3.0,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> Connection:
    """Connect, retrying while the database starts up.

    Railway's staging MySQL sleeps when idle. The first connection wakes it but is
    refused, so a one-shot `alembic upgrade head` in the pre-deploy step would fail.
    """
    deadline = clock() + timeout
    while True:
        try:
            return engine.connect()
        except OperationalError as exc:
            if clock() + interval > deadline:
                raise
            print(f"Database not ready ({exc.orig}); retrying in {interval:g}s", file=sys.stderr)
            sleep(interval)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one database session per request."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
