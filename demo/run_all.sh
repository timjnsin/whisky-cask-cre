#!/usr/bin/env bash
set -euo pipefail

npm run seed

# Start API in background as a direct process for reliable shutdown.
npx tsx api/src/index.ts &
API_PID=$!

cleanup() {
  kill "$API_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 2

npm run simulate:por
npm run simulate:attributes
npm run simulate:lifecycle:webhook
npm run simulate:lifecycle:reconcile
