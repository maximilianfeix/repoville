#!/bin/sh
# Publishes site-dist/ to the gh-pages branch (orphan, one commit per deploy).
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WT="$ROOT/.cache/gh-pages"
cd "$ROOT"
git fetch -q origin gh-pages 2>/dev/null || true
rm -rf "$WT"
git worktree prune
if git show-ref -q --verify refs/remotes/origin/gh-pages; then
  git worktree add -q -B gh-pages "$WT" origin/gh-pages
else
  git worktree add -q --detach "$WT"
  (cd "$WT" && git checkout -q --orphan gh-pages && git rm -rqf .)
fi
cd "$WT"
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$ROOT/site-dist/." .
git add -A
git -c user.name="Maxi" -c user.email="223365242+maximilianfeix@users.noreply.github.com" commit -qm "site: deploy $(git -C "$ROOT" rev-parse --short HEAD)" || echo "nothing to deploy"
git push -q origin gh-pages
cd "$ROOT" && git worktree remove --force "$WT"
echo "deployed"
