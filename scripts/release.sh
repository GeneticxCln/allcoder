#!/usr/bin/env bash
set -euo pipefail

# release.sh — local release helper for npm packages
# Usage: bash scripts/release.sh <patch|minor|major|prerelease|x.y.z> [--dry-run]
# Requires: git, npm. Optional: NPM_TOKEN env var for CI-less authenticated publish.

BUMP="${1:-}"
DRY_RUN=${2:-}
if [[ -z "$BUMP" ]]; then
  echo "Usage: $0 <patch|minor|major|prerelease|x.y.z> [--dry-run]" >&2
  exit 2
fi

is_dry=false
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  is_dry=true
fi

# Ensure clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree not clean. Commit or stash changes first." >&2
  exit 2
fi

# Ensure we’re on main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "You are on '$BRANCH'. Switch to 'main' or proceed manually." >&2
  exit 2
fi

echo "Running quality checks..."
npm run lint
npm run typecheck
npm test

# Build before versioning to fail fast
npm run build

# Prepare npm auth if NPM_TOKEN is provided
CLEAN_NPMRC=false
if [[ -n "${NPM_TOKEN:-}" ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
  CLEAN_NPMRC=true
fi
trap '[[ "$CLEAN_NPMRC" == true ]] && rm -f ~/.npmrc || true' EXIT

# Bump version and tag
if [[ "$is_dry" == true ]]; then
  echo "[DRY-RUN] npm version $BUMP"
else
  npm version "$BUMP" -m "chore: release v%s"
  git push origin main --follow-tags
fi

# Publish
if [[ "$is_dry" == true ]]; then
  echo "[DRY-RUN] npm publish --access public"
else
  npm publish --access public
fi

echo "Done."
