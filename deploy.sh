#!/bin/bash
# MSB Signals — Sync data + deploy to Netlify
# Run periodically or on-demand to push fresh signal data

set -e
WORKSPACE="$HOME/.openclaw/workspace"
DIR="$WORKSPACE/msb-signals"

cd "$DIR"

# Sync latest signal data
bash sync-data.sh

# Try Netlify deploy
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Attempting Netlify deploy..."
if npx netlify-cli deploy --prod --dir=public --functions=netlify/functions 2>/dev/null; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ✅ Netlify deploy succeeded"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ❌ Netlify deploy failed (credits/auth issue)"
fi

# Always push to GitHub Pages (free, no limits)
bash sync-data.sh
cp public/index.html index.html
cd "$DIR"
if git diff --quiet 2>/dev/null; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] No changes to push to GitHub"
else
  git add -A
  git commit -m "Auto-sync signal data $(date -u +%Y-%m-%dT%H:%M:%SZ)" 2>/dev/null
  git push 2>/dev/null && echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ✅ GitHub Pages updated" || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ❌ GitHub push failed"
fi
