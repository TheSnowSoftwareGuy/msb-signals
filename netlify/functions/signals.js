// MSB Signal API — /api/signals
// Returns trading signals with tier-based access

// API key tiers
const TIERS = {
  free: { delayMs: 3600000, maxPerDay: 100, webhooks: false },
  pro: { delayMs: 0, maxPerDay: 10000, webhooks: true },
  enterprise: { delayMs: 0, maxPerDay: 100000, webhooks: true }
};

// Simple in-memory rate tracking (resets on cold start — fine for MVP)
const rateCounts = {};

function hashKey(key) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}

function loadKeys() {
  try { return require('./data/api-keys.json'); }
  catch { return {}; }
}

function loadSignals() {
  try { return require('./data/signals-cache.json'); }
  catch { return []; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  let tier = 'free';
  let keyId = 'anonymous';

  if (token) {
    const keys = loadKeys();
    const hashed = hashKey(token);
    const keyEntry = Object.values(keys).find(k => k.hash === hashed && k.active);
    if (keyEntry) {
      tier = keyEntry.tier || 'free';
      keyId = keyEntry.id || hashed.slice(0, 8);
    }
  }

  const tierConfig = TIERS[tier] || TIERS.free;

  // Rate limiting
  const today = new Date().toISOString().slice(0, 10);
  const rateKey = `${keyId}:${today}`;
  rateCounts[rateKey] = (rateCounts[rateKey] || 0) + 1;
  if (rateCounts[rateKey] > tierConfig.maxPerDay) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Rate limit exceeded', tier, limit: tierConfig.maxPerDay })
    };
  }

  // Load signals
  let signals = loadSignals();

  // Apply delay for free tier
  if (tierConfig.delayMs > 0) {
    const cutoff = Date.now() - tierConfig.delayMs;
    signals = signals.filter(s => new Date(s.timestamp).getTime() < cutoff);
  }

  // Query params
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit) || 50, 200);
  const type = params.type; // filter by signal type
  const symbol = params.symbol; // filter by symbol
  const since = params.since; // ISO timestamp

  if (type) signals = signals.filter(s => s.type === type);
  if (symbol) signals = signals.filter(s => s.symbol && s.symbol.toUpperCase() === symbol.toUpperCase());
  if (since) signals = signals.filter(s => new Date(s.timestamp) > new Date(since));

  // Most recent first
  signals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  signals = signals.slice(0, limit);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier,
      count: signals.length,
      delayed: tierConfig.delayMs > 0,
      signals
    })
  };
};
