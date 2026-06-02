#!/usr/bin/env bash
# Run on the Mac Mini from the repo root after `git pull`.
# Usage: ./scripts/deploy.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

echo "==> Starting dependencies (redis, postgres)"
docker compose up -d redis postgres

echo "==> Installing npm dependencies"
npm ci

echo "==> Running migrations"
npm run migration:run

echo "==> Building application"
npm run build

PM2_NAME="${PM2_NAME:-booknest-backend}"

if pm2 describe "$PM2_NAME" &>/dev/null; then
  echo "==> Restarting pm2 process: $PM2_NAME"
  pm2 restart "$PM2_NAME" --update-env
else
  echo "==> Starting pm2 process: $PM2_NAME"
  pm2 start npm --name "$PM2_NAME" -- run start:prod
fi

pm2 save

echo "==> Deploy finished"
