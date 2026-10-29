// Nearby stock: GET /api/albums/{id}/stock at every radius (#71).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, load, visitor } from './common.js';

export const options = {
  ...load,
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{endpoint:stock}': ['p(95)<300'],  // baseline × ~5; see docs/TESTING.md
  },
};

const RADII = [10, 25, 50, 100];

export default function () {
  const radius = RADII[__ITER % RADII.length];
  const res = http.get(`${BASE_URL}/api/albums/1/stock?zip=10011&radius=${radius}`,
    { ...visitor(), tags: { endpoint: 'stock' } });
  check(res, { 'status 200': (r) => r.status === 200, 'has stores': (r) => Array.isArray(r.json('stores')) });
  sleep(0.5);
}
