const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const NOTE_COLORS = new Set(['sunshine', 'blush', 'sky', 'mint', 'lilac']);
const INK_COLORS = new Set(['charcoal', 'navy', 'berry', 'forest', 'violet']);
const FONTS = new Set(['patrick', 'caveat']);
const MAX_NOTES = 120;
const MAX_LENGTH = 160;

let sql = null;
let tableReady = null;
const recentPosts = new Map();

function getSql() {
  if (!sql) sql = neon(process.env.KV_REST_API_DATABASE_URL);
  return sql;
}

function ensureTable() {
  if (!tableReady) {
    tableReady = getSql()`
      CREATE TABLE IF NOT EXISTS believe_notes (
        id BIGSERIAL PRIMARY KEY,
        content VARCHAR(160) NOT NULL,
        note_color VARCHAR(16) NOT NULL,
        ink_color VARCHAR(16) NOT NULL,
        font VARCHAR(16) NOT NULL,
        x DOUBLE PRECISION NOT NULL,
        y DOUBLE PRECISION NOT NULL,
        rotation DOUBLE PRECISION NOT NULL,
        owner_hash CHAR(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  }
  return tableReady;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.resolve({}); }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 12000) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (_) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function cleanToken(value) {
  return typeof value === 'string' && value.length >= 20 && value.length <= 128 ? value : '';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function canPost(req) {
  const key = clientIp(req);
  const now = Date.now();
  const history = (recentPosts.get(key) || []).filter(time => now - time < 60_000);
  if (history.length >= 6) return false;
  history.push(now);
  recentPosts.set(key, history);
  if (recentPosts.size > 1000) {
    for (const [ip, times] of recentPosts) {
      if (!times.some(time => now - time < 60_000)) recentPosts.delete(ip);
    }
  }
  return true;
}

function serialize(row, owned = false) {
  return {
    id: String(row.id),
    content: row.content,
    noteColor: row.note_color,
    inkColor: row.ink_color,
    font: row.font,
    x: Number(row.x),
    y: Number(row.y),
    rotation: Number(row.rotation),
    owned,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return json(res, 405, { error: 'method not allowed' });
  if (!process.env.KV_REST_API_DATABASE_URL) return json(res, 503, { error: 'storage unavailable' });

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const token = cleanToken(req.headers['x-believe-owner']);
      const ownerHash = token ? hashToken(token) : '';
      const rows = await getSql()`
        SELECT id, content, note_color, ink_color, font, x, y, rotation,
               (owner_hash = ${ownerHash}) AS owned
        FROM (
          SELECT * FROM believe_notes ORDER BY created_at DESC LIMIT ${MAX_NOTES}
        ) recent
        ORDER BY created_at ASC
      `;
      return json(res, 200, { notes: rows.map(row => serialize(row, Boolean(row.owned))) });
    }

    const body = await readBody(req);
    const token = cleanToken(body.ownerToken);
    if (!token) return json(res, 400, { error: 'invalid owner token' });
    const ownerHash = hashToken(token);

    if (req.method === 'POST') {
      if (!canPost(req)) return json(res, 429, { error: 'Please wait a moment before adding another note.' });
      const content = typeof body.content === 'string'
        ? body.content.trim().split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).join('\n').slice(0, MAX_LENGTH)
        : '';
      if (!content) return json(res, 400, { error: 'Write something before sticking it up.' });
      const noteColor = NOTE_COLORS.has(body.noteColor) ? body.noteColor : 'sunshine';
      const inkColor = INK_COLORS.has(body.inkColor) ? body.inkColor : 'charcoal';
      const font = FONTS.has(body.font) ? body.font : 'patrick';
      const x = clamp(body.x);
      const y = clamp(body.y);
      const rotation = clamp(body.rotation, -6, 6);
      const rows = await getSql()`
        INSERT INTO believe_notes (content, note_color, ink_color, font, x, y, rotation, owner_hash)
        VALUES (${content}, ${noteColor}, ${inkColor}, ${font}, ${x}, ${y}, ${rotation}, ${ownerHash})
        RETURNING id, content, note_color, ink_color, font, x, y, rotation
      `;
      return json(res, 201, { note: serialize(rows[0], true) });
    }

    const id = String(body.id || '');
    if (!/^\d+$/.test(id)) return json(res, 400, { error: 'invalid note' });
    if (req.method === 'DELETE') {
      const rows = await getSql()`
        DELETE FROM believe_notes
        WHERE id = ${id} AND owner_hash = ${ownerHash}
        RETURNING id
      `;
      if (!rows.length) return json(res, 403, { error: 'This note belongs to another visitor.' });
      return json(res, 200, { deleted: String(rows[0].id) });
    }

    const x = clamp(body.x);
    const y = clamp(body.y);
    const rows = await getSql()`
      UPDATE believe_notes
      SET x = ${x}, y = ${y}, updated_at = now()
      WHERE id = ${id} AND owner_hash = ${ownerHash}
      RETURNING id, content, note_color, ink_color, font, x, y, rotation
    `;
    if (!rows.length) return json(res, 403, { error: 'This note belongs to another visitor.' });
    return json(res, 200, { note: serialize(rows[0], true) });
  } catch (error) {
    console.error('[believe-notes]', error);
    return json(res, 500, { error: 'The wall could not be reached.' });
  }
};
