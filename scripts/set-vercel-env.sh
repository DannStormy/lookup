#!/usr/bin/env bash
# Push the vars in .env.local up to Vercel (Production + Preview).
# Run AFTER `vercel login` and `vercel link`. Safe to re-run (it replaces).
#
#   bash scripts/set-vercel-env.sh
#
# Only non-empty, non-comment lines are sent. Fill in the UPSTASH_* lines in
# .env.local first if you want durable push subscriptions.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "No .env.local found. Nothing to push."
  exit 1
fi

# don't ship a localhost site url to production
SKIP="NEXT_PUBLIC_SITE_URL"

while IFS='=' read -r key value; do
  # skip comments / blanks / no value
  [[ "$key" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${key// }" ]] && continue
  [[ -z "${value// }" ]] && continue
  [[ "$key" == "$SKIP" ]] && continue

  for env in production preview; do
    # replace any existing value, then add
    npx vercel env rm "$key" "$env" -y >/dev/null 2>&1 || true
    printf '%s' "$value" | npx vercel env add "$key" "$env" >/dev/null 2>&1 \
      && echo "set  $key  ($env)" \
      || echo "FAIL $key  ($env)"
  done
done < .env.local

echo
echo "Done. Now deploy:  npx vercel --prod"
