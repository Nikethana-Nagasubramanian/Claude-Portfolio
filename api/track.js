// Click-tracking sink for Pulse Grid — writes events to Postgres (Neon, via
// Vercel's Storage integration) so counts persist, instead of Vercel Web
// Analytics' custom Events, which requires a paid plan.
//
// KV_REST_API_DATABASE_URL is the pooled connection string Vercel injected
// when the Neon database was connected to this project (Settings > Storage).

const { neon } = require('@neondatabase/serverless');

// Lazy: neon() throws synchronously if the env var is unset, which would
// otherwise crash this module at require-time (and take the whole function
// down before it can even respond). Deferring construction to first use lets
// the handler return a clean error instead.
let sql = null;
function getSql() {
  if (!sql) sql = neon(process.env.KV_REST_API_DATABASE_URL);
  return sql;
}

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = getSql()`
      CREATE TABLE IF NOT EXISTS click_events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        data JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
  }
  return tableReady;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10000) req.destroy(); // guard against absurd payloads
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('method not allowed');
  }

  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    body = {};
  }

  const name = typeof body.name === 'string' ? body.name.slice(0, 80) : 'unknown';
  const data = body.data && typeof body.data === 'object' ? body.data : {};

  try {
    await ensureTable();
    await getSql()`INSERT INTO click_events (name, data) VALUES (${name}, ${JSON.stringify(data)})`;
  } catch (e) {
    console.error('[track] insert failed', e.message);
    // Don't fail the request over a tracking hiccup — the click still worked.
  }

  res.statusCode = 204;
  res.end();
};
