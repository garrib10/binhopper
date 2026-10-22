## What and why

<!-- One or two sentences: what changed and why. Link the issue if there is one. -->

## Spec

- Acceptance criteria covered: <!-- e.g. AC-01, AC-03, or "none" -->
- Mockup matched: <!-- e.g. design/mockups/Stores.dc.html, or "no UI change" -->

## Testing

- [ ] Tests added or updated for the acceptance criteria above (AC ids named in the tests)
- [ ] `pytest` passes (backend)
- [ ] `npm test` and `npm run build` pass (frontend)
- [ ] UI checked at phone (390 px) and desktop (1440 px) widths
- [ ] UI checked in light and dark mode
- [ ] Manually tested: <!-- what you clicked through -->

## Security and privacy

- [ ] No secrets, keys or real personal data in the code or commits
- [ ] New user data defaults to private ("Only me")
- [ ] User input is validated on the backend, not only in the UI
- [ ] Outside services (Discogs, Places) are mocked in tests

## Branch flow

- [ ] Feature/fix → `develop` · Promotion → `develop → staging` or `staging → main` · Hotfix → `main`
