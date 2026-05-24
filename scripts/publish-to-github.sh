#!/usr/bin/env bash
# Create public GitHub repo and push main. Run from project root:
#   chmod +x scripts/publish-to-github.sh && ./scripts/publish-to-github.sh

set -euo pipefail
cd "$(dirname "$0")/.."

REPO_NAME="ionic-measure-extension"
DESCRIPTION="Pixel-perfect measurement overlay for Ionic apps in Chrome"

if ! command -v git >/dev/null; then
  echo "git is required." >&2
  exit 1
fi

if [ ! -d .git ]; then
  if ! git init -b main; then
    echo "git init failed. Run this script in Terminal.app from the project folder." >&2
    exit 1
  fi
fi

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -m "$(cat <<'EOF'
Initial release: Ionic Measure Chrome extension.

Component, spacing, and alignment measurement modes for Ionic 7/8 apps with shadow-piercing hit tests and draggable HUD.
EOF
)"
fi

if command -v gh >/dev/null; then
  if ! gh repo view "$REPO_NAME" >/dev/null 2>&1; then
    gh repo create "$REPO_NAME" --public --description "$DESCRIPTION" --source=. --remote=origin --push
  else
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/$(gh api user -q .login)/${REPO_NAME}.git"
    git push -u origin main
  fi
  echo "Done: https://github.com/$(gh api user -q .login)/${REPO_NAME}"
  exit 0
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Install GitHub CLI (gh) or set GITHUB_TOKEN, then re-run." >&2
  exit 1
fi

LOGIN=$(curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
  https://api.github.com/user | python3 -c "import sys,json; print(json.load(sys.stdin)['login'])")

CREATE=$(curl -fsSL -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"${REPO_NAME}\",\"description\":\"${DESCRIPTION}\",\"private\":false}" 2>&1) || true

if echo "$CREATE" | grep -q '"full_name"'; then
  echo "Created repository."
elif echo "$CREATE" | grep -q 'name already exists'; then
  echo "Repository already exists."
else
  echo "$CREATE" >&2
  exit 1
fi

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${LOGIN}/${REPO_NAME}.git"
git push -u origin main

echo "Done: https://github.com/${LOGIN}/${REPO_NAME}"
