# Branching and releases

Code moves through three long-lived branches: **develop → staging → main**.

| Branch | Holds | Deploys to | Who merges into it |
| --- | --- | --- | --- |
| `develop` | Finished work, ready for the next release | — | `feature/*`, `fix/*`, `chore/*`, Dependabot |
| `staging` | The next release candidate, being tested | Staging environment | `develop` only (or `hotfix/*`) |
| `main` | What users have (production) | Production environment | `staging` only (or `hotfix/*`) |

## Day to day

1. Branch from `develop`: `git switch develop && git pull && git switch -c feature/album-page`
2. Commit, push, open a pull request **into `develop`**. CI runs.
3. Merge when CI is green.

Branch names: `feature/…` for new things, `fix/…` for bugs, `chore/…` for setup and tooling.

## Releasing

1. **Actions → Promote → Run workflow → to: staging.** This opens a `develop → staging` PR
   listing every change. Merge it; the Deploy workflow ships it to staging.
2. Test on staging.
3. **Actions → Promote → Run workflow → to: main.** Merge the `staging → main` PR.
   Deploy ships to production, and Release tags it (`v2026.10.22`) with notes.

## Hotfixes

For something broken in production that can't wait for a full release:

1. Branch from `main`: `git switch -c hotfix/short-name origin/main`
2. PR into `main`, merge when CI is green.
3. The Back-merge workflow opens a `main → develop` PR. Merge it so the next release
   doesn't undo the fix. (If staging is mid-release, merge the hotfix there too.)

## Workflows

| Workflow | Runs when | Does |
| --- | --- | --- |
| CI | Every PR; pushes to develop, staging, main | Lint, backend tests, frontend tests + build, browser tests |
| Branch policy | Every PR | Fails a PR that skips a step (e.g. `feature/x → main`) |
| Promote | You run it from the Actions tab | Opens the `develop → staging` or `staging → main` PR |
| Deploy | Push to staging or main | Builds and checks; deploy step is a placeholder until hosting is chosen |
| Release | Push to main | Creates a dated tag and GitHub Release with generated notes |
| Back-merge | Push to main | Opens `main → develop` when main has changes develop lacks |
| CodeQL | PRs and pushes (GitHub's default setup) | Security scanning |
| Dependabot | Weekly / monthly | Dependency update PRs into develop |

## One-time GitHub settings

Do these after the `develop` and `staging` branches exist.

1. **Default branch → `develop`** (Settings → General → Default branch). New PRs, Dependabot
   security updates and clones then start from develop.
2. **Let workflows open PRs** (Settings → Actions → General → Workflow permissions): check
   "Allow GitHub Actions to create and approve pull requests". Promote and Back-merge need it.
3. **Rulesets** (Settings → Rules → Rulesets → New branch ruleset), one per branch:

   | Rule | develop | staging | main |
   | --- | --- | --- | --- |
   | Restrict deletions | ✓ | ✓ | ✓ |
   | Block force pushes | ✓ | ✓ | ✓ |
   | Require a pull request before merging (0 approvals is fine solo) | — | ✓ | ✓ |
   | Require status checks: `backend`, `frontend`, `e2e` | ✓ | ✓ | ✓ |
   | Require status check: `check` (Branch policy) | — | ✓ | ✓ |

   Add status checks only after CI has passed once; GitHub lists check names from past runs.
4. **Environments** (Settings → Environments): open `production` and add yourself as a
   required reviewer, so production deploys wait for your click.
5. **Optional, `PROMOTE_TOKEN` secret:** PRs opened with the built-in token don't start CI on
   their own. Add a fine-grained personal access token (this repo only; contents read, pull
   requests write) as the secret `PROMOTE_TOKEN`, or close and reopen those PRs to start CI.
