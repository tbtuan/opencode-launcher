#!/bin/bash
cd "$(dirname "$0")" || exit 1

if node check-build.js; then
  echo "[opencode] Build is up to date."
else
  echo "[opencode] Source files changed, rebuilding..."
  npm run build || exit 1
fi

if [ "$(uname -s)" = "Linux" ]; then
  # Electron's bundled SUID sandbox is not root-owned in local npm installs.
  nohup npm start -- --no-sandbox > /dev/null 2>&1 &
else
  nohup npm start > /dev/null 2>&1 &
fi
