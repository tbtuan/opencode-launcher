#!/bin/bash
cd "$(dirname "$0")"
if node check-build.js; then
  echo "[opencode] Build is up to date."
else
  echo "[opencode] Source files changed, rebuilding..."
  npm run build
fi
nohup npm start > /dev/null 2>&1 &
