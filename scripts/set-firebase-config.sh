#!/usr/bin/env bash
# Copies the Firebase web config from .env.local into GitHub Actions repository
# variables, so the deployed build gets the same settings as local dev.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "No .env.local found. Copy .env.example to .env.local and fill it in first." >&2
  exit 1
fi

keys=(
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
)

for key in "${keys[@]}"; do
  value="$(grep -E "^${key}=" .env.local | head -1 | cut -d= -f2- || true)"
  if [[ -z "$value" ]]; then
    echo "  skip $key (empty in .env.local)"
    continue
  fi
  gh variable set "$key" --body "$value"
  echo "  set  $key"
done

echo
echo "Done. Re-run the deploy workflow to pick these up:"
echo "  gh workflow run 'Deploy to GitHub Pages'"
