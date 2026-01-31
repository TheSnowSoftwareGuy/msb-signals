#!/bin/bash
# Syncs MSB trading data to the signal API's Netlify functions data dir
# Run this periodically (e.g., every 5 min via cron or from monitor.js)

WORKSPACE="$HOME/.openclaw/workspace"
SRC="$WORKSPACE/moltstreetbets/data"
DST="$WORKSPACE/msb-signals/netlify/functions/data"

mkdir -p "$DST"

# Copy alerts as signals cache
if [ -f "$SRC/alerts.json" ]; then
  cp "$SRC/alerts.json" "$DST/signals-cache.json"
fi

# Copy dashboard
if [ -f "$SRC/dashboard.json" ]; then
  cp "$SRC/dashboard.json" "$DST/dashboard-cache.json"
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Data synced to signal API"
