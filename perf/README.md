# Performance baseline (#71)

k6 scripts for the two hot paths. They run only against seeded data (`seed_sample` plus the
CI ZIP fixture), never against staging, Discogs or Places.

| Script | Endpoints | Fails when |
| --- | --- | --- |
| `stock.js` | `GET /api/albums/1/stock` at 10/25/50/100 mi | p95 > 300 ms or > 1% errors |
| `search.js` | `GET /api/search`, `GET /api/browse` | either p95 > 400 ms or > 1% errors |

Each uses 10 virtual users for about a minute, with a different `X-Forwarded-For` per user so
the per-IP search rate limit doesn't skew the numbers.

**In CI:** Actions › Performance baseline › Run workflow.

**Locally** (Docker running, API on port 8020 against a seeded database):

```bash
docker run --rm --add-host=host.docker.internal:host-gateway -v "$PWD/perf:/perf:ro" \
  -e BASE_URL=http://host.docker.internal:8020 grafana/k6:2.2.0 run /perf/stock.js
```

Baseline numbers and when to raise a threshold: `docs/TESTING.md` › Performance baseline.
