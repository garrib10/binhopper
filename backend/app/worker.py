"""Run separately: python -m app.worker [--enqueue masters:123] [--once]."""
import argparse
import logging
from datetime import timedelta

from apscheduler.schedulers.blocking import BlockingScheduler
from sqlalchemy import select, text

from app.catalog_refresh import apply_response, expire
from app.config import settings
from app.db import SessionLocal, engine
from app.discogs import RequestQueue, enqueue
from app.inventory import drain_inventory
from app.models import CatalogJob, utcnow

log = logging.getLogger(__name__)


def drain(queue, now=utcnow):
    s = queue.session
    expire(s, now())
    drain_inventory(queue, now)
    jobs = s.scalars(select(CatalogJob).where(CatalogJob.next_fetch <= now()).order_by(CatalogJob.id)).all()
    for job in jobs:
        try:
            payload = queue.get(job.kind, job.discogs_id)
            apply_response(s, job.kind, payload, now())
            job.next_fetch = now() + timedelta(hours=5)
            s.commit()
        except Exception:
            s.rollback()
            log.warning("Catalog job %s failed; retry scheduled", job.id)
            job.next_fetch = now() + timedelta(minutes=5)
            s.commit()
    expire(s, now())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enqueue", action="append", default=[], metavar="KIND:ID")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    # A database-level lease prevents overlapping Railway worker instances from
    # running separate quota queues during deployment/restart. Never run in the API.
    with engine.connect() as lease, SessionLocal() as session:
        if engine.dialect.name == "mysql" and lease.scalar(text("SELECT GET_LOCK('binhopper-discogs-worker', 0)")) != 1:
            raise SystemExit("Another catalog worker owns the queue")
        try:
            for task in args.enqueue:
                kind, identifier = task.split(":", 1)
                enqueue(session, kind, int(identifier))
            queue = RequestQueue(session, settings.discogs_token, settings.discogs_user_agent)
            try:
                drain(queue)
                if not args.once:
                    scheduler = BlockingScheduler(timezone="UTC")
                    scheduler.add_job(drain, "interval", minutes=5, args=[queue], max_instances=1, coalesce=True)
                    scheduler.start()
            finally:
                queue.close()
        finally:
            if engine.dialect.name == "mysql":
                lease.execute(text("SELECT RELEASE_LOCK('binhopper-discogs-worker')"))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
