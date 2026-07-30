#!/bin/bash
set -e

VERSION=
if [ -z "" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.0.0"
  exit 1
fi

echo "Creating release v..."
npm version "" --workspaces --include-workspace-root -m "chore(release): v%s"
git push --follow-tags
echo "Release v created and pushed."
