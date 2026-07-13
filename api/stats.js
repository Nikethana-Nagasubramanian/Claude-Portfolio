// Read-only view of click_events counts written by api/track.js.
// GET /api/stats -> { "get_code_click": 42, "export_gif_click": 17, ... }

const { neon } = require('@neondatabase/serverless');

// Lazy for the same reason as api/track.js: neon() throws synchronously if
// the env var is unset, which would otherwise crash this module at
// require-time instead of producing a clean error response.
let sql = null;
function getSql() {
  if (!sql) sql = neon(process.env.KV_REST_API_DATABASE_URL);
  return sql;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'method not allowed' }));
  }

  try {
    const rows = await getSql()`
      SELECT name, COUNT(*)::int AS count
      FROM click_events
      GROUP BY name
      ORDER BY count DESC
    `;
    const counts = {};
    for (const row of rows) counts[row.name] = row.count;
    res.statusCode = 200;
    res.end(JSON.stringify(counts));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'query failed', message: e.message }));
  }
};
