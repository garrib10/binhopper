// Search and browse: GET /api/search and /api/browse (#71).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, load, visitor } from './common.js';

export const options = {
  ...load,
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{endpoint:search}': ['p(95)<400'],  // baseline × ~5; see docs/TESTING.md
    'http_req_duration{endpoint:browse}': ['p(95)<400'],
  },
};

const QUERIES = ['rum', 'fleetwood', 'warner', 'blue', 'zz'];

export default function () {
  const q = QUERIES[__ITER % QUERIES.length];
  const search = http.get(`${BASE_URL}/api/search?q=${q}&zip=10011&radius=25`, { ...visitor(), tags: { endpoint: 'search' } });
  check(search, { 'search 200': (r) => r.status === 200 });
  const browse = http.get(`${BASE_URL}/api/browse?genre=Rock&zip=10011&radius=25`, { ...visitor(), tags: { endpoint: 'browse' } });
  check(browse, { 'browse 200': (r) => r.status === 200 });
  sleep(0.5);
}
