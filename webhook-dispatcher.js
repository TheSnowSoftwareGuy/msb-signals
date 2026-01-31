#!/usr/bin/env node
// MSB Signals — Webhook Dispatcher
// Called by monitor.js on every new alert. Pushes to subscribed webhooks.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKSPACE = path.join(require('os').homedir(), '.openclaw/workspace');
const SUBSCRIBERS_FILE = path.join(WORKSPACE, 'msb-signals/data/subscribers.json');
const DISPATCH_LOG = path.join(WORKSPACE, 'msb-signals/data/dispatch.log');

function loadSubscribers() {
  try { return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8')); }
  catch { return []; }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(DISPATCH_LOG, line + '\n');
}

function hmacSign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

async function dispatch(alert) {
  const subscribers = loadSubscribers();
  if (!subscribers.length) {
    log(`No subscribers — skipping dispatch for ${alert.type} ${alert.symbol || ''}`);
    return;
  }

  const payload = {
    event: 'signal',
    signal: alert,
    timestamp: new Date().toISOString(),
    source: 'msb-signals'
  };

  for (const sub of subscribers) {
    if (!sub.active || !sub.url) continue;

    // Filter by type if subscriber has preferences
    if (sub.types && sub.types.length && !sub.types.includes(alert.type)) continue;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-MSB-Signature': hmacSign(payload, sub.secret || 'msb-default')
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(sub.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);
      log(`→ ${sub.url}: ${res.status} (${alert.type} ${alert.symbol || ''})`);
    } catch (e) {
      log(`✗ ${sub.url}: ${e.message} (${alert.type} ${alert.symbol || ''})`);
    }
  }
}

// CLI mode: pass alert as JSON arg
if (require.main === module) {
  const alertJson = process.argv[2];
  if (!alertJson) { console.error('Usage: node webhook-dispatcher.js \'{"type":"NEW_BUY",...}\''); process.exit(1); }
  try {
    const alert = JSON.parse(alertJson);
    dispatch(alert).catch(e => log(`Dispatch error: ${e.message}`));
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }
}

module.exports = { dispatch };
