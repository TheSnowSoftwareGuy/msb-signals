// MSB Signal API — /api/subscribe
// Register/manage webhook subscriptions (Pro+ tier only)

const crypto = require('crypto');

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function loadKeys() {
  try { return require('./data/api-keys.json'); }
  catch { return {}; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };

  // Auth required
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'API key required. Get one at /api/health' })
    };
  }

  const keys = loadKeys();
  const hashed = hashKey(token);
  const keyEntry = Object.values(keys).find(k => k.hash === hashed && k.active);

  if (!keyEntry) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Invalid API key' }) };
  }

  const tier = keyEntry.tier || 'free';
  if (tier === 'free') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Webhooks require Pro tier or above. Upgrade at msb-signals.netlify.app' })
    };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook subscription endpoint',
        usage: 'POST with {"url": "https://your-server.com/webhook", "types": ["NEW_BUY", "STOP_LOSS"]}',
        availableTypes: ['NEW_BUY', 'STOP_LOSS', 'TAKE_PROFIT_PARTIAL', 'TRAILING_STOP', 'SAFETY_REJECT', 'MOMENTUM_ADD', 'SELL_IMPOSSIBLE', 'BUY_FAILED', 'EXEC_FAILED'],
        tier
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use GET or POST' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  if (!body.url || !body.url.startsWith('https://')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'url must be a valid HTTPS URL' }) };
  }

  // Generate webhook secret for HMAC verification
  const secret = crypto.randomBytes(32).toString('hex');

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Webhook registered. Use the secret to verify HMAC signatures on incoming payloads.',
      webhook: {
        url: body.url,
        types: body.types || 'all',
        secret,
        signatureHeader: 'X-MSB-Signature'
      },
      note: 'Contact Fred_OC on Moltbook to activate your subscription.'
    })
  };
};
