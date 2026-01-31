#!/usr/bin/env node
/**
 * MSB Signals API — Self-hosted server
 * Raw http module (no Express needed). Port 3849.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = 3849;
const DATA_DIR = path.join(__dirname, '..', 'moltstreetbets', 'data');
const KEYS_FILE = path.join(__dirname, 'data', 'api-keys.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function loadJSON(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); }
  catch { return fallback; }
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

const TIERS = {
  free: { delayMs: 3600000, maxPerDay: 100 },
  pro: { delayMs: 0, maxPerDay: 10000 },
  enterprise: { delayMs: 0, maxPerDay: 100000 }
};
const rateCounts = {};

function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  let tier = 'free', keyId = 'anon';
  if (token) {
    const keys = loadJSON(KEYS_FILE, {});
    const h = hashKey(token);
    const entry = Object.values(keys).find(k => k.hash === h && k.active);
    if (entry) { tier = entry.tier || 'free'; keyId = entry.id || h.slice(0, 8); }
  }
  return { tier, keyId };
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;
  const params = Object.fromEntries(parsed.searchParams);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  // API routes
  if (pathname === '/api/health') {
    return json(res, {
      status: 'ok', service: 'msb-signals', version: '1.0.0', mode: 'self-hosted',
      tiers: { free: '1hr delayed, 100 req/day', pro: 'Real-time + webhooks $29/mo', enterprise: 'Full access $99/mo' },
      endpoints: ['/api/health', '/api/signals', '/api/portfolio']
    });
  }

  if (pathname === '/api/signals') {
    const { tier, keyId } = authenticate(req);
    const tierConfig = TIERS[tier] || TIERS.free;
    const today = new Date().toISOString().slice(0, 10);
    const rk = `${keyId}:${today}`;
    rateCounts[rk] = (rateCounts[rk] || 0) + 1;
    if (rateCounts[rk] > tierConfig.maxPerDay) return json(res, { error: 'Rate limit exceeded' }, 429);

    let signals = loadJSON(path.join(DATA_DIR, 'alerts.json'), []);
    if (tierConfig.delayMs > 0) {
      const cutoff = Date.now() - tierConfig.delayMs;
      signals = signals.filter(s => new Date(s.timestamp).getTime() < cutoff);
    }
    if (params.type) signals = signals.filter(s => s.type === params.type);
    if (params.symbol) signals = signals.filter(s => s.symbol?.toUpperCase() === params.symbol.toUpperCase());
    if (params.since) signals = signals.filter(s => new Date(s.timestamp) > new Date(params.since));
    const limit = Math.min(parseInt(params.limit) || 50, 200);
    signals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    signals = signals.slice(0, limit);
    return json(res, { tier, count: signals.length, delayed: tierConfig.delayMs > 0, signals });
  }

  if (pathname === '/api/portfolio') {
    const d = loadJSON(path.join(DATA_DIR, 'dashboard.json'), null);
    if (!d) return json(res, { error: 'Unavailable' }, 503);
    return json(res, {
      lastUpdate: d.lastUpdate,
      portfolioValue: Math.round(d.portfolioValue * 100) / 100,
      portfolioPnlPct: Math.round(d.portfolioPnlPct * 100) / 100,
      cashPct: Math.round(d.cashPct * 100) / 100,
      positions: (d.positions || []).map(p => ({
        symbol: p.symbol, strategy: p.strategy,
        pnlPct: Math.round(p.pnlPct * 100) / 100,
        sizePct: Math.round(p.sizePct * 100) / 100,
        holdHours: p.holdHours
      })),
      positionCount: (d.positions || []).length
    });
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(PUBLIC_DIR, filePath);
  if (fs.existsSync(fullPath) && !fullPath.includes('..')) {
    const ext = path.extname(fullPath);
    const mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain' });
    return fs.createReadStream(fullPath).pipe(res);
  }

  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[${new Date().toISOString()}] MSB Signals API on http://127.0.0.1:${PORT}`);
});
