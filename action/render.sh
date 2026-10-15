#!/usr/bin/env bash
# Renders the checked-out repository with the Repoville release tarball.
# Inputs come from env (see action.yml); outputs go to $GITHUB_OUTPUT when set.
set -euo pipefail

: "${RV_PATH:=.}" "${RV_OUT:=repoville-city}" "${RV_SINCE:=1y}" "${RV_MAX:=4000}" "${RV_FORMATS:=}" "${RV_VERSION:=latest}" "${RV_REPO:=}"

if [ "$(git -C "$RV_PATH" rev-parse --is-shallow-repository 2>/dev/null || echo false)" = "true" ]; then
  echo "::warning::Shallow checkout: churn and age need history. Use actions/checkout with fetch-depth: 0."
fi

if [ "$RV_VERSION" = "latest" ]; then
  url="https://github.com/maximilianfeix/repoville/releases/latest/download/repoville.tgz"
else
  url="https://github.com/maximilianfeix/repoville/releases/download/${RV_VERSION}/repoville.tgz"
fi

formats="html"
[ -n "$RV_FORMATS" ] && formats="html,$RV_FORMATS"

npx --yes --package="$url" repoville "$RV_PATH" -o "$RV_OUT" --format "$formats" --since "$RV_SINCE" --max-buildings "$RV_MAX" --gallery

# Normalise names for Pages: index.html + city.png at the top of the folder.
html=$(find "$RV_OUT" -maxdepth 1 -name '*.html' | head -n 1)
[ -n "$html" ] && [ "$html" != "$RV_OUT/index.html" ] && mv "$html" "$RV_OUT/index.html"
gallery=$(find "$RV_OUT/gallery" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)
if [ -n "$gallery" ]; then
  cp "$gallery/city.png" "$RV_OUT/city.png"
  cp "$gallery/meta.json" "$RV_OUT/meta.json"
  rm -rf "$RV_OUT/gallery"
fi

badge=""
if [ -n "$RV_REPO" ]; then
  owner="${RV_REPO%%/*}"
  name="${RV_REPO#*/}"
  badge="[![Visit this repo in Repoville](https://img.shields.io/badge/visit_this_repo-in_Repoville-4E8C3A?style=for-the-badge&labelColor=23262E)](https://${owner}.github.io/${name}/)"
fi
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "dir=$RV_OUT" >> "$GITHUB_OUTPUT"
  echo "badge=$badge" >> "$GITHUB_OUTPUT"
fi
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Repoville city"
    echo
    echo "Rendered to \`$RV_OUT/index.html\`."
    [ -n "$badge" ] && { echo; echo "Badge for your README:"; echo; echo '```md'; echo "$badge"; echo '```'; }
  } >> "$GITHUB_STEP_SUMMARY"
fi
echo "city ready in $RV_OUT"
