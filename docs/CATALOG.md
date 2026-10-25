# Catalog import and worker

Catalog names, artists, genres, tracklists and vinyl pressings come from the monthly
Discogs CC0 dumps. API lookups are only for missing catalog records and remote cover/photo
URLs. Inventory synchronization belongs to #90, not this worker.

## Local offline sample

From backend, with the virtualenv active and MySQL running:

```bash
alembic upgrade head
python -m scripts.import_discogs_dump --sample
```

The committed fixture contains 30 real vinyl releases, 30 masters and 21 credited artists.
See tests/fixtures/discogs_cc0/README.md for exact source/provenance and CC0 license.
Import is repeatable by Discogs artist/master/release IDs; existing local sample data is
not overwritten by title. Releases without a master use a negative release ID internally
as an album identity; do not construct a Discogs master URL from those negative IDs.
Missing tracklists are filled from a vinyl release with its original side positions.

## Monthly full import (manual, never in tests/CI)

1. Open https://data.discogs.com/ and choose the same monthly artists, masters and releases
   dumps. Use the site's download links and checksum file. Direct anonymous S3 listing
   may be denied. Example URL pattern: `https://data.discogs.com/?download=data/YYYY/discogs_YYYYMM01_releases.xml.gz`.
2. Download all three `.xml.gz` files to a local directory with adequate free disk space;
   verify the published checksums. Do not commit full dumps or download them in CI.
3. Back up the destination database, migrate, then run from backend:

```bash
python -m scripts.import_discogs_dump --path /path/to/monthly-dumps
# Optional local trial: imports at most this many rows per file:
python -m scripts.import_discogs_dump --path /path/to/monthly-dumps --limit 100
```

The importer opens gzip streams and iterparses one record at a time, clears parsed XML,
commits in batches and bounds ORM state. It processes artists → masters → vinyl releases;
non-vinyl releases are skipped. Re-run each new month's files to update CC0 records.
Run one importer at a time, separately from the worker; take a backup before a large refresh.
It does not scrape websites, fetch artwork or contact the Discogs API.

## Separate worker and gap queue

Set `DISCOGS_TOKEN` and optional `DISCOGS_USER_AGENT` only on the backend worker. The default
agent identifies Binhopper and its repository. Never put the token in Vercel/VITE variables.

```bash
python -m app.worker --enqueue masters:123 --enqueue artists:456
# Useful for an operator-run single drain (still real API calls outside tests):
python -m app.worker --once --enqueue releases:789
# Normal long-running process:
python -m app.worker
```

In Railway add a **separate worker service** using the same backend source/root and environment
MySQL reference as the API, with start command `python -m app.worker`, no HTTP healthcheck
and one replica. Keep staging and production databases separate. Do not start it inside
uvicorn. The worker holds a MySQL advisory lock for its whole lifetime, so an overlapping
worker exits instead of creating a second queue. Request reservations persist in MySQL,
so restarts do not reset the rolling quota. All worker API calls share this queue; do not
create an independent API client for the future inventory job.

APScheduler drains durable jobs every five minutes with max_instances=1; successes refresh
in five hours, failures retry in five minutes. A rolling window permits at most 60 calls in
60 seconds (25 without a token); response quota/remaining/used headers may reduce the limit
or impose an additional wait. Failed requests consume reservations too. No retries bypass
the quota. Automated AC-16 tests queue 100 mocked jobs using a fake clock on SQLite and MySQL.

API-only records use `api_fetched_at`; remote image URLs use `cover_fetched_at` or
`image_fetched_at`. At six hours, API-only fields are scrubbed while preserving IDs/foreign
keys needed by user records, and image URLs are dropped. CC0 fields survive. Reader endpoints
must hide expired API-only records and images at request time even if the worker is down
(the screen PRs implement that guard). No image bytes are downloaded, cached or re-hosted.
Failed refreshes never extend a successful fetch timestamp. Albums/artist screens link a
followed Discogs attribution to their source record; image absence uses a placeholder.
