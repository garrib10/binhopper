// Shared settings for the k6 baselines (#71). Runs against seeded data only:
// BASE_URL is a local or CI API with seed_sample + the CI ZIP fixture, never staging.
export const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';

// The API rate-limits search per visitor IP (120/min, X-Forwarded-For). Each virtual user
// gets its own fake IP so the baseline measures speed, not the limiter.
export function visitor() {
  return { headers: { 'X-Forwarded-For': `10.71.${Math.floor(__VU / 250)}.${__VU % 250}` } };
}

export const load = {
  stages: [
    { duration: '10s', target: 10 },  // warm up (and wake a sleeping database)
    { duration: '40s', target: 10 },  // steady: 10 users browsing at once
    { duration: '10s', target: 0 },
  ],
};
