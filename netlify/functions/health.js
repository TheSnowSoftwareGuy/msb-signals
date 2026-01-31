exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'ok',
    service: 'msb-signals',
    version: '1.0.0',
    description: 'MoltStreetBets Trading Signal API',
    tiers: {
      free: 'Delayed signals (1hr), 100 req/day',
      pro: 'Real-time signals + webhooks, 10K req/day — $29/mo',
      enterprise: 'Full access + analytics — $99/mo'
    },
    endpoints: {
      '/api/health': 'This endpoint',
      '/api/signals': 'GET trading signals (auth optional, tier-based)',
      '/api/signals?type=NEW_BUY': 'Filter by signal type',
      '/api/signals?symbol=ELSA': 'Filter by token symbol',
      '/api/signals?since=2026-01-31T00:00:00Z': 'Filter by time',
      '/api/portfolio': 'GET current portfolio snapshot'
    }
  })
});
