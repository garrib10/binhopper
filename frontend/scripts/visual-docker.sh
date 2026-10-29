#!/bin/sh
# Run the visual tests (#73) inside the same Linux image CI uses, so screenshots match.
# From frontend/:  sh scripts/visual-docker.sh                     (compare)
#                  sh scripts/visual-docker.sh --update-snapshots  (accept new baselines)
# Needs Docker (Colima). Keep the image tag equal to the installed @playwright/test version.
set -e
IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble
cd "$(dirname "$0")/.."
# node_modules lives in a container-only volume: the Mac's native binaries don't run on Linux.
docker run --rm --ipc=host \
  -v "$PWD:/work" -v binhopper-visual-node-modules:/work/node_modules -w /work \
  "$IMAGE" sh -c "npm ci --no-audit --no-fund >/dev/null && npx playwright test -c playwright.visual.config.ts $*"
