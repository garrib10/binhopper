---
name: Release sign-off
about: Record checks and go/no-go for each develop → staging promotion
title: 'Release sign-off: '
---

<!-- Open one issue for EACH develop → staging promotion. Complete it on staging
before deciding whether to promote staging → main. Use merge commits for promotions. -->

## Promotion

- Develop → staging PR:
- Staging merge commit SHA:
- Staging frontend URL:
- Tester and date:
- Proposed staging → main PR (when ready):

## Automated evidence

- [ ] Promotion PR CI is green (backend, frontend, e2e, integration, system, branch policy and security checks). Run URL:
- [ ] Staging Deploy is green: API `/api/health` reports the staging promotion SHA; APP_URL returns HTTP 200. Run URL:
- [ ] **Staging system** is green against the deployed staging app, at 390 and 1440 px. Run URL:
- [ ] All three results refer to the same staging promotion commit; record the SHA above.

<!-- Paste direct run URLs. A local system run does not replace the staging run.
Never run the staging system suite against production. -->

## Manual smoke on staging

Follow docs/TESTING.md's manual and exploratory checklist. Check each size/theme:

- [ ] 390 px, light
- [ ] 390 px, dark
- [ ] 1440 px, light
- [ ] 1440 px, dark

- [ ] Core loop: search → album → wishlist → nearby stock → shop hand-off → collection
- [ ] Valid, invalid and unknown ZIP; each radius and empty-radius widening
- [ ] Freshness and reported-missing labels
- [ ] Keyboard focus, screen-reader spot check and accessible controls
- [ ] Slow network, loading states, API failure and retry
- [ ] Privacy isolation with a second account
- [ ] No new production secrets or real personal data in sample/test fixtures

<!-- If a feature is not built yet, record it as a known issue rather than checking
it as tested. Never simulate an API outage on shared production for this checklist. -->

## Known issues

List issue links, severity, impact and any accepted deferrals. Write "None" if empty.
Unbuilt MVP features belong here; hosting readiness alone is not product launch approval.

## Go / no-go

- Decision: **Pending / Go / No-go**
- Decided by:
- Date:
- Reason / required follow-up:
- [ ] Go is recorded before staging → main is merged.
- [ ] Production rollout plan and compatible rollback/backup are identified.

## Production follow-through (after Go)

- Staging → main PR / merge SHA:
- Production Deploy verification run:
- [ ] Production API SHA and frontend HTTP 200 confirmed; no sample data.
- [ ] Monitoring and rollback target confirmed.

<!-- Runbook: docs/DEPLOY.md. Never merge a promotion while this decision is Pending or No-go. -->
