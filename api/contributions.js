// GitHub contribution proxy.
//
// Why this exists: github.com/users/{user}/contributions is an HTML fragment
// that browsers can't fetch directly (no CORS headers), so the scrape must run
// server-side. We scrape GitHub first (so we're not dependent on a third party),
// and fall back to the community jogruber.de JSON API if the scrape fails —
// which is the most likely thing to break when GitHub changes its markup.
//
// Runs on Vercel's Node runtime (global fetch, CommonJS — no package.json needed).

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — this data barely changes
const RATE_LIMIT = 30; // requests per IP per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

// Per-instance state. Serverless instances are ephemeral and not shared, so
// both of these are best-effort — good enough to blunt keystroke storms and
// keep our own IP from hammering GitHub, which is all we need here.
const cache = new Map(); // username -> { expires, payload }
const rate = new Map(); // ip -> { count, resetAt }

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// GitHub usernames: 1–39 chars, alphanumeric or single internal hyphens.
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

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

// Parse GitHub's HTML fragment into [{ date, count, level }].
// Defensive on purpose: attribute order varies, count lives in a sibling
// <tool-tip> in current markup but was a data-count attribute in older versions.
function parseGitHubHtml(html) {
  // id -> count, from the tooltips ("5 contributions on July 13th." / "No contributions on ...")
  const tips = new Map();
  const tipRe = /<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g;
  let tm;
  while ((tm = tipRe.exec(html))) {
    const text = tm[2].trim();
    let count = 0;
    const m = text.match(/^([\d,]+)\s+contribution/i);
    if (m) count = parseInt(m[1].replace(/,/g, ''), 10) || 0;
    tips.set(tm[1], count);
  }

  const cells = [];
  const tdRe = /<td\b[^>]*\bdata-date="[^"]*"[^>]*>/g;
  let td;
  while ((td = tdRe.exec(html))) {
    const tag = td[0];
    if (!/ContributionCalendar-day/.test(tag)) continue;
    const date = (tag.match(/\bdata-date="([^"]+)"/) || [])[1];
    const levelRaw = (tag.match(/\bdata-level="([^"]+)"/) || [])[1];
    if (!date || levelRaw == null) continue;
    const level = Math.max(0, Math.min(4, parseInt(levelRaw, 10) || 0));
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    const dataCount = (tag.match(/\bdata-count="([^"]+)"/) || [])[1];
    let count;
    if (dataCount != null) count = parseInt(dataCount, 10) || 0;
    else if (id && tips.has(id)) count = tips.get(id);
    else count = level > 0 ? level : 0;
    cells.push({ date, count, level });
  }
  cells.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return cells;
}

async function scrapeGitHub(username) {
  const url = `https://github.com/users/${encodeURIComponent(username)}/contributions`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (res.status === 404) return { kind: 'not_found' };
  if (res.status === 429 || res.status === 403) return { kind: 'blocked' };
  if (!res.ok) return { kind: 'error', status: res.status };
  const html = await res.text();
  const contributions = parseGitHubHtml(html);
  // Zero cells from a 200 response means the markup changed — a parse failure,
  // NOT a user with no contributions. Surface it distinctly so the fallback runs.
  if (contributions.length === 0) return { kind: 'parse_failure' };
  return { kind: 'ok', contributions };
}

async function fallbackJogruber(username) {
  const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(
    username
  )}?y=last`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 404) return { kind: 'not_found' };
  if (!res.ok) return { kind: 'error', status: res.status };
  const json = await res.json();
  const list = Array.isArray(json.contributions) ? json.contributions : [];
  if (list.length === 0) return { kind: 'parse_failure' };
  const contributions = list
    .map((d) => ({
      date: d.date,
      count: Number(d.count) || 0,
      level: Math.max(0, Math.min(4, Number(d.level) || 0)),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { kind: 'ok', contributions };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const username = String((req.query && req.query.username) || '').trim();
  if (!username) {
    return send(res, 400, { error: 'missing_username', message: 'Provide a ?username= value.' });
  }
  if (!USERNAME_RE.test(username)) {
    return send(res, 400, {
      error: 'invalid_username',
      message: 'That is not a valid GitHub username.',
    });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return send(res, 429, {
      error: 'rate_limited',
      message: 'Too many requests. Please slow down and try again in a minute.',
    });
  }

  const key = username.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Cache', 'HIT');
    return send(res, 200, cached.payload);
  }

  let result;
  try {
    result = await scrapeGitHub(username);
  } catch (e) {
    result = { kind: 'error', status: 0, detail: String(e && e.message) };
  }

  // Definitive "no such user" — don't waste a fallback call.
  if (result.kind === 'not_found') {
    return send(res, 404, {
      error: 'user_not_found',
      message: `GitHub user "${username}" was not found.`,
    });
  }

  let source = 'github';
  if (result.kind !== 'ok') {
    // Scrape was blocked, errored, or the markup changed. Try the fallback API.
    const scrapeIssue = result.kind;
    let fb;
    try {
      fb = await fallbackJogruber(username);
    } catch (e) {
      fb = { kind: 'error', status: 0, detail: String(e && e.message) };
    }

    if (fb.kind === 'not_found') {
      return send(res, 404, {
        error: 'user_not_found',
        message: `GitHub user "${username}" was not found.`,
      });
    }
    if (fb.kind === 'ok') {
      result = fb;
      source = 'fallback';
    } else if (scrapeIssue === 'blocked') {
      return send(res, 429, {
        error: 'github_unavailable',
        message: 'GitHub is rate-limiting requests right now. Please try again shortly.',
      });
    } else {
      // Both our scrape and the fallback failed to produce data — most likely a
      // markup change on GitHub's side. Distinct from "user has no contributions".
      return send(res, 502, {
        error: 'parse_failure',
        message:
          'Could not read contribution data. GitHub may have changed its page structure.',
      });
    }
  }

  const total = result.contributions.reduce((s, d) => s + d.count, 0);
  const payload = {
    username,
    source,
    total,
    contributions: result.contributions,
  };
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload });

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('X-Cache', 'MISS');
  return send(res, 200, payload);
};

// Exported for local testing.
module.exports.parseGitHubHtml = parseGitHubHtml;
