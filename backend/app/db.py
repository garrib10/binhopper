import sys
import time
from collections.abc import Callable, Iterator

from sqlalchemy import Connection, Engine, create_engine, delete, event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


# MySQL client errors raised while the server is down or still starting up.
CANT_CONNECT, LOST_CONNECTION = 2003, 2013


def connect_when_ready(dbapi, cargs, cparams, timeout: float = 20.0, interval: float = 1.0,
                       sleep: Callable[[float], None] = time.sleep,
                       clock: Callable[[], float] = time.monotonic):
    """Open a DBAPI connection, retrying while MySQL is down or still starting up."""
    deadline = clock() + timeout
    while True:
        try:
            return dbapi.connect(*cargs, **cparams)
        except dbapi.OperationalError as exc:
            code = exc.args[0] if exc.args else None
            if code not in (CANT_CONNECT, LOST_CONNECTION) or clock() + interval > deadline:
                raise
            print(f"Database not ready ({exc}); retrying in {interval:g}s", file=sys.stderr)
            sleep(interval)


def wait_for_server_on_connect(engine: Engine, timeout: float = 20.0, interval: float = 1.0) -> None:
    """Make every new MySQL connection retry while the server wakes up (#132).

    Railway's staging MySQL sleeps when idle and refuses connections while it wakes.
    `pool_pre_ping` notices the dead pooled connection, but its reconnect would fail
    the request with a 500. Other errors (e.g. a wrong password) still fail at once.
    """

    @event.listens_for(engine, "do_connect")
    def connect(dialect, conn_rec, cargs, cparams):
        return connect_when_ready(dialect.loaded_dbapi, cargs, cparams, timeout, interval)


engine = create_engine(settings.database_url, pool_pre_ping=True)
if engine.dialect.name == "mysql":
    wait_for_server_on_connect(engine)
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


def delete_where(db: Session, model, *conditions) -> int:
    """Delete matching rows by primary key; returns how many.

    A plain `DELETE … WHERE` on MySQL locks the index gaps it scans, even when nothing
    matches, and two requests that then insert into those gaps deadlock (1213). Reading
    the ids first (a non-locking read) and deleting exactly those rows locks only them.
    """
    ids = db.scalars(select(model.id).where(*conditions)).all()
    if ids:
        db.execute(delete(model).where(model.id.in_(ids)))
    return len(ids)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one database session per request."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
