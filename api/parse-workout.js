// Server-side proxy for Racked's photo-upload parsing.
//
// This is a static site — anything in the browser bundle is public, so the
// Anthropic API key can only live here, never in tools/racked's client code.
// That also makes this endpoint itself publicly callable by anyone who finds
// it, not just the page, so it rate-limits per IP and caps payload size to
// bound cost exposure (best-effort only: serverless instances are ephemeral
// and not shared, same caveat as api/contributions.js's rate limiter).

const MAX_BODY_BYTES = 8 * 1024 * 1024; // covers a typical phone photo as base64
const RATE_LIMIT = 8; // requests per IP per window
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ALLOWED_MEDIA = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MODEL = 'claude-haiku-4-5-20251001'; // cheap enough for a public endpoint; bump if accuracy suffers

const rate = new Map(); // ip -> { count, resetAt }

const PROMPT =
  'You extract a strength-training workout from a photo of gym notes. ' +
  "Format of the note: an exercise name, then one line per set written as REPS-WEIGHT " +
  "(reps first, then weight in lbs). A line like '12,12,10-135' means three separate sets " +
  "of 12, 12, and 10 reps, all at 135 lb. Strip any 'lbs'/'lb' text. " +
  'Return ONLY valid JSON, no markdown, no commentary, in exactly this shape: ' +
  '{"title": string, "exercises": [{"name": string, "sets": [{"r": number, "w": number}]}]}. ' +
  'r = reps, w = weight in lb. If a weight is missing use null.';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || now > entry.resetAt) {
    rate.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('payload_too_large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '600');
    return send(res, 429, {
      error: 'rate_limited',
      message: 'Too many photos parsed from this connection. Try again in a few minutes.',
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return send(res, 500, { error: 'not_configured', message: 'Parsing is not configured on the server.' });
  }

  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch (e) {
    if (e.message === 'payload_too_large') {
      return send(res, 413, { error: 'payload_too_large', message: 'That photo is too large.' });
    }
    return send(res, 400, { error: 'invalid_json' });
  }

  const { image, media } = body;
  if (!image || typeof image !== 'string') {
    return send(res, 400, { error: 'missing_image', message: 'No image data received.' });
  }
  const mediaType = ALLOWED_MEDIA.has(media) ? media : 'image/png';

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    console.error('[parse-workout] upstream unreachable', e.message);
    return send(res, 502, { error: 'upstream_unreachable', message: 'Could not reach the vision model. Try again.' });
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('[parse-workout] anthropic error', resp.status, detail.slice(0, 500));
    return send(res, 502, { error: 'upstream_error', message: 'Could not reach the vision model. Try again.' });
  }

  const data = await resp.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    return send(res, 422, {
      error: 'parse_failure',
      message: "Couldn't read that photo. Try a clearer, straight-on shot.",
    });
  }

  if (!Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
    return send(res, 422, { error: 'no_exercises', message: 'No exercises found in that photo.' });
  }

  return send(res, 200, {
    title: typeof parsed.title === 'string' && parsed.title ? parsed.title : 'Session',
    exercises: parsed.exercises.map((e) => ({
      name: typeof e.name === 'string' && e.name ? e.name : 'Exercise',
      sets: Array.isArray(e.sets)
        ? e.sets.map((s) => ({
            r: typeof s.r === 'number' ? s.r : null,
            w: typeof s.w === 'number' ? s.w : null,
          }))
        : [],
    })),
  });
};
