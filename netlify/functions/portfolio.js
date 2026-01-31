// MSB Portfolio Snapshot API

function loadDashboard() {
  try { return require('./data/dashboard-cache.json'); }
  catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const dashboard = loadDashboard();
  if (!dashboard) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'Portfolio data temporarily unavailable' })
    };
  }

  // Sanitize — don't expose wallet addresses or gas info
  const safe = {
    lastUpdate: dashboard.lastUpdate,
    portfolioValue: Math.round(dashboard.portfolioValue * 100) / 100,
    portfolioPnlPct: Math.round(dashboard.portfolioPnlPct * 100) / 100,
    cashPct: Math.round(dashboard.cashPct * 100) / 100,
    positions: (dashboard.positions || []).map(p => ({
      symbol: p.symbol,
      strategy: p.strategy,
      pnlPct: Math.round(p.pnlPct * 100) / 100,
      sizePct: Math.round(p.sizePct * 100) / 100,
      holdHours: p.holdHours
    })),
    positionCount: (dashboard.positions || []).length
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(safe)
  };
};
