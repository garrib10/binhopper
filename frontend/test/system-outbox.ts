import { fileURLToPath } from 'node:url';

// The local system-test API writes sign-in emails here as JSON (EMAIL_BACKEND=file);
// e2e-system/auth.spec.ts reads the links from it.
export const SYSTEM_OUTBOX = fileURLToPath(new URL('../test-results/system-outbox', import.meta.url));
