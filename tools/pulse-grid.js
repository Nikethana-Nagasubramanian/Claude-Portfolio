// Pulse Grid — canvas rendering, animation, and client-side GIF export.
// No build step: plain ES module. Data comes from /api/contributions.

// Vercel Web Analytics custom event — window.va is queued by the inline shim
// in pulse-grid.html before the beacon script loads, so this is safe to call
// immediately even before the script has actually loaded.
function trackEvent(name, data) {
  if (typeof window.va === 'function') window.va('event', { name, data });
}

// ---------- config ----------
const CELL = 11;          // square size in CSS px
const GAP = 3;            // gap between cells
const STEP = CELL + GAP;  // per-column / per-row stride
const RADIUS = 2.5;       // rounded-corner radius
const PAD = 8;            // padding inside canvas
const LABEL_LEFT = 30;    // room for weekday labels
const LABEL_TOP = 18;     // room for month labels
const BG = '#ffffff';     // canvas background (also the GIF background)

const SPEED_SLOW_MS = 4000; // slider value 0   (left  = slow)
const SPEED_FAST_MS = 800;  // slider value 100 (right = fast)
const CELL_DUR = 0.18;    // fraction of the timeline a single cell's pop takes
const GIF_FPS = 20;
const GIF_HOLD_MS = 1000; // hold on the finished frame before the GIF loops

function speedFromSlider(v) {
  return Math.round(SPEED_SLOW_MS - (SPEED_SLOW_MS - SPEED_FAST_MS) * (v / 100));
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAY_ROWS = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

// ---------- palettes ----------
// [level0 "off" ... level4 "most active"]
const PALETTES = {
  green:  { name: 'GitHub',   colors: ['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'] },
  violet: { name: 'Violet',   colors: ['#eeecf6','#c9b8f0','#a583e6','#7c4fd6','#5a2ea6'] },
  ocean:  { name: 'Ocean',    colors: ['#e8eef4','#a8d0ef','#5fa8e6','#2f7fd4','#1b4f8f'] },
  ember:  { name: 'Ember',    colors: ['#f4ece7','#f6c99a','#f39b52','#e2652a','#a83411'] },
  mono:   { name: 'Mono',     colors: ['#ececec','#c4c4c4','#949494','#5c5c5c','#262626'] },
  pink:   { name: 'Pink',     colors: ['#fbe4ef','#f6a8ce','#ec6fae','#d63384','#8e1550'] },
};

// ---------- animation styles ----------
// Each returns a per-cell start fraction in [0, 1-CELL_DUR].
const STYLES = {
  column: (c, r, cols) => (cols <= 1 ? 0 : (c / (cols - 1)) * (1 - CELL_DUR)),
  wave:   (c, r, cols) => {
    const max = (cols - 1) + 6 || 1;
    return ((c + r) / max) * (1 - CELL_DUR);
  },
  random: (c, r, cols, rnd) => rnd() * (1 - CELL_DUR),
};

// ---------- easing ----------
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

// Deterministic PRNG so "random" style is stable across replay + export.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- state ----------
const state = {
  username: '',
  data: [],            // full year: [{date,count,level}]
  total: 0,
  source: 'github',
  rangeMonths: 12,
  paletteKey: 'green',
  styleKey: 'column',
  speedMs: speedFromSlider(50),
  weeks: [],           // [[cell|null x7] per column]
  monthLabels: [],     // [{col, label}]
  layout: null,        // {cols, width, height}
  schedule: [],        // schedule[col][row] = start fraction
  animId: 0,
  lastProgress: 1,
  exporting: false,
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const form = $('search');
const usernameInput = $('username');
const submitBtn = $('submit');
const holder = $('holder');
const stateEl = $('state');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const stageTitle = $('stageTitle');
const stageTotal = $('stageTotal');
const controls = $('controls');
const rangeGroup = $('range');
const palettesGroup = $('palettes');
const stylesGroup = $('styles');
const speedSlider = $('speed');
const speedValue = $('speedValue');
const replayBtn = $('replay');
const exportBtn = $('export');
const exportStatus = $('exportStatus');
const exportBar = $('exportBar');
const bottomBar = $('bottomBar');
const getCodeBtn = $('getCode');
const modalOverlay = $('modalOverlay');
const modalClose = $('modalClose');
const modalClose2 = $('modalClose2');
const copyCodeBtn = $('copyCode');
const codeOutput = $('codeOutput').querySelector('code');

// ---------- grid building ----------
function ymdToUTC(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function filterByRange(data, months) {
  if (months >= 12 || data.length === 0) return data;
  const last = ymdToUTC(data[data.length - 1].date);
  const cutoff = new Date(last);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const cutMs = cutoff.getTime();
  return data.filter((d) => ymdToUTC(d.date) >= cutMs);
}

// Group days into GitHub-style columns (weeks starting Sunday).
function buildWeeks(data) {
  if (data.length === 0) return { weeks: [], monthLabels: [] };
  const first = ymdToUTC(data[0].date);
  const firstDow = new Date(first).getUTCDay(); // 0=Sun
  const gridStart = first - firstDow * 86400000; // back up to that week's Sunday
  const weeks = [];
  for (const cell of data) {
    const ms = ymdToUTC(cell.date);
    const col = Math.floor((ms - gridStart) / (7 * 86400000));
    const row = new Date(ms).getUTCDay();
    if (!weeks[col]) weeks[col] = new Array(7).fill(null);
    weeks[col][row] = cell;
  }
  for (let c = 0; c < weeks.length; c++) if (!weeks[c]) weeks[c] = new Array(7).fill(null);

  // Month labels: mark a column when its earliest date's month first appears.
  const monthLabels = [];
  let prevMonth = -1;
  for (let c = 0; c < weeks.length; c++) {
    const cell = weeks[c].find(Boolean);
    if (!cell) continue;
    const month = new Date(ymdToUTC(cell.date)).getUTCMonth();
    if (month !== prevMonth) {
      // avoid crowding: need a little gap from the previous label
      const lastLabel = monthLabels[monthLabels.length - 1];
      if (!lastLabel || c - lastLabel.col >= 3) monthLabels.push({ col: c, label: MONTHS[month] });
      prevMonth = month;
    }
  }
  return { weeks, monthLabels };
}

function computeSchedule(weeks, styleKey) {
  const cols = weeks.length;
  const fn = STYLES[styleKey] || STYLES.column;
  const rnd = mulberry32(0x9e3779b1 ^ (cols * 2654435761));
  const sched = [];
  for (let c = 0; c < cols; c++) {
    sched[c] = [];
    for (let r = 0; r < 7; r++) sched[c][r] = fn(c, r, cols, rnd);
  }
  return sched;
}

const RANGE_TEXT = { 1: 'the last month', 3: 'the last 3 months', 6: 'the last 6 months', 12: 'the last year' };

function updateTotal(scoped) {
  const sum = scoped.reduce((s, d) => s + d.count, 0);
  const via = state.source === 'fallback' ? ' · via fallback' : '';
  stageTotal.textContent = sum === 0
    ? `no contributions in ${RANGE_TEXT[state.rangeMonths]}${via}`
    : `${sum.toLocaleString()} contributions in ${RANGE_TEXT[state.rangeMonths]}${via}`;
}

function rebuild() {
  const scoped = filterByRange(state.data, state.rangeMonths);
  updateTotal(scoped);
  const { weeks, monthLabels } = buildWeeks(scoped);
  state.weeks = weeks;
  state.monthLabels = monthLabels;
  state.schedule = computeSchedule(weeks, state.styleKey);
  const cols = weeks.length;
  state.layout = {
    cols,
    width: LABEL_LEFT + cols * STEP - GAP + PAD,
    height: LABEL_TOP + 7 * STEP - GAP + PAD,
  };
  sizeCanvas(canvas, ctx, state.layout, window.devicePixelRatio || 1);
}

function sizeCanvas(cv, context, layout, dpr) {
  cv.width = Math.round(layout.width * dpr);
  cv.height = Math.round(layout.height * dpr);
  cv.style.width = layout.width + 'px';
  cv.style.height = layout.height + 'px';
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------- rendering ----------
function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

// Draw one frame at reveal progress [0..1]. Pure w.r.t. the passed context so
// the GIF exporter can reuse it against an offscreen canvas.
function renderFrame(c, progress, layout, weeks, schedule, palette) {
  c.clearRect(0, 0, layout.width, layout.height);
  c.fillStyle = BG;
  c.fillRect(0, 0, layout.width, layout.height);

  // weekday labels (left)
  c.fillStyle = '#a3a3a3';
  c.font = '600 10px "Instrument Sans", system-ui, sans-serif';
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  for (const row in WEEKDAY_ROWS) {
    const y = LABEL_TOP + row * STEP + CELL / 2;
    c.fillText(WEEKDAY_ROWS[row], PAD - 2, y);
  }

  // month labels (top)
  c.textBaseline = 'alphabetic';
  for (const m of state.monthLabels) {
    const x = LABEL_LEFT + m.col * STEP;
    c.fillText(m.label, x, LABEL_TOP - 6);
  }

  // cells
  const colors = palette.colors;
  for (let col = 0; col < weeks.length; col++) {
    const week = weeks[col];
    for (let row = 0; row < 7; row++) {
      const cell = week[row];
      if (!cell) continue;
      const start = schedule[col][row];
      const local = (progress - start) / CELL_DUR;
      if (local <= 0) continue;
      const t = local >= 1 ? 1 : local;
      const scale = easeOutBack(t);
      const alpha = easeOutCubic(t);
      const size = CELL * scale;
      const cx = LABEL_LEFT + col * STEP + CELL / 2;
      const cy = LABEL_TOP + row * STEP + CELL / 2;
      c.globalAlpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
      c.fillStyle = colors[cell.level];
      roundRect(c, cx - size / 2, cy - size / 2, size, size, RADIUS * scale);
      c.fill();
    }
  }
  c.globalAlpha = 1;
}

function draw(progress) {
  state.lastProgress = progress;
  renderFrame(ctx, progress, state.layout, state.weeks, state.schedule, PALETTES[state.paletteKey]);
}

// ---------- animation ----------
function play() {
  cancelAnimationFrame(state.animId);
  const start = performance.now();
  const duration = state.speedMs;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    draw(progress);
    if (progress < 1) state.animId = requestAnimationFrame(tick);
  };
  state.animId = requestAnimationFrame(tick);
}

// ---------- data flow ----------
const RANGE_LABEL = { 1: '1m', 3: '3m', 6: '6m', 12: '1y' };

function showState(html, isError) {
  canvas.hidden = true;
  stateEl.hidden = false;
  stateEl.className = 'state' + (isError ? ' error' : '');
  stateEl.innerHTML = html;
}
function hideState() { stateEl.hidden = true; canvas.hidden = false; }

async function load(username) {
  cancelAnimationFrame(state.animId);
  controls.hidden = true;
  bottomBar.hidden = true;
  stageTotal.textContent = '';
  stageTitle.hidden = false;
  stageTitle.textContent = 'Loading…';
  showState('<span class="spinner"></span>Fetching contribution data…', false);
  submitBtn.disabled = true;

  try {
    const res = await fetch(`/api/contributions?username=${encodeURIComponent(username)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msgs = {
        user_not_found: `No GitHub user <b>${escapeHtml(username)}</b>.<span class="hint">Check the spelling and try again.</span>`,
        invalid_username: `That doesn't look like a valid GitHub username.`,
        rate_limited: `You're going a little fast.<span class="hint">Wait a minute and try again.</span>`,
        github_unavailable: `GitHub is rate-limiting right now.<span class="hint">Give it a moment and retry.</span>`,
        parse_failure: `Couldn't read the contribution data.<span class="hint">GitHub may have changed its page — this usually fixes itself.</span>`,
      };
      showState(msgs[body.error] || `Something went wrong (${res.status}).`, true);
      stageTitle.textContent = 'Error';
      return;
    }

    state.username = body.username;
    state.data = body.contributions || [];
    state.total = body.total || 0;
    state.source = body.source || 'github';
    // A user with no contributions is not an error — the grid still renders and
    // animates cleanly; the stage total (set in rebuild) reflects that.
    stageTitle.innerHTML = `<b>${escapeHtml(body.username)}</b>`;

    hideState();
    controls.hidden = false;
    bottomBar.hidden = false;
    rebuild();
    play();
  } catch (e) {
    showState(`Network error — could not reach the server.<span class="hint">${escapeHtml(String(e.message || e))}</span>`, true);
    stageTitle.textContent = 'Error';
  } finally {
    submitBtn.disabled = false;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- GIF export ----------
let gifLibPromise = null;
function loadGifLib() {
  if (gifLibPromise) return gifLibPromise;
  gifLibPromise = new Promise((resolve, reject) => {
    if (window.GIF) return resolve(window.GIF);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.js';
    s.onload = () => resolve(window.GIF);
    s.onerror = () => reject(new Error('Could not load the GIF encoder.'));
    document.head.appendChild(s);
  });
  return gifLibPromise;
}

// The worker must be same-origin, so fetch the CDN worker and wrap it in a blob URL.
let workerUrlPromise = null;
function loadWorkerUrl() {
  if (workerUrlPromise) return workerUrlPromise;
  workerUrlPromise = fetch('https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js')
    .then((r) => { if (!r.ok) throw new Error('worker fetch failed'); return r.text(); })
    .then((txt) => URL.createObjectURL(new Blob([txt], { type: 'application/javascript' })));
  return workerUrlPromise;
}

async function exportGif() {
  if (state.exporting || !state.layout) return;
  state.exporting = true;
  exportBtn.disabled = true;
  replayBtn.disabled = true;
  exportBar.style.display = 'block';
  const bar = exportBar.firstElementChild;
  bar.style.width = '0%';
  exportStatus.textContent = 'Preparing encoder…';

  try {
    const [GIF, workerUrl] = await Promise.all([loadGifLib(), loadWorkerUrl()]);
    const { width, height } = state.layout;
    const gif = new GIF({ workers: 2, quality: 10, width, height, workerScript: workerUrl, background: BG });

    // Render frames to an offscreen canvas at DPR 1 (keeps the file small).
    const off = document.createElement('canvas');
    off.width = width; off.height = height;
    const octx = off.getContext('2d');
    const palette = PALETTES[state.paletteKey];

    const revealFrames = Math.round((state.speedMs / 1000) * GIF_FPS);
    const holdFrames = Math.round((GIF_HOLD_MS / 1000) * GIF_FPS);
    const delay = Math.round(1000 / GIF_FPS);

    for (let i = 0; i <= revealFrames; i++) {
      renderFrame(octx, i / revealFrames, state.layout, state.weeks, state.schedule, palette);
      gif.addFrame(octx, { copy: true, delay });
    }
    for (let i = 0; i < holdFrames; i++) {
      renderFrame(octx, 1, state.layout, state.weeks, state.schedule, palette);
      gif.addFrame(octx, { copy: true, delay });
    }

    gif.on('progress', (p) => {
      bar.style.width = Math.round(p * 100) + '%';
      exportStatus.textContent = `Encoding GIF… ${Math.round(p * 100)}%`;
    });
    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.username}-contributions-${RANGE_LABEL[state.rangeMonths]}.gif`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      exportStatus.textContent = `Saved ${a.download} (${(blob.size / 1024).toFixed(0)} KB)`;
      exportBar.style.display = 'none';
      state.exporting = false;
      exportBtn.disabled = false;
      replayBtn.disabled = false;
      draw(1);
    });

    exportStatus.textContent = 'Encoding GIF… 0%';
    gif.render();
  } catch (e) {
    exportStatus.textContent = 'Export failed: ' + (e.message || e);
    exportBar.style.display = 'none';
    state.exporting = false;
    exportBtn.disabled = false;
    replayBtn.disabled = false;
  }
}

// ---------- controls wiring ----------
function setPressed(group, attr, value) {
  group.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value)));
  });
}

function buildPaletteSwatches() {
  palettesGroup.innerHTML = '';
  for (const [key, pal] of Object.entries(PALETTES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.pal = key;
    b.title = pal.name;
    b.setAttribute('aria-label', pal.name + ' palette');
    b.setAttribute('aria-pressed', String(key === state.paletteKey));
    const grad = document.createElement('span');
    grad.className = 'grad';
    grad.style.background = `linear-gradient(135deg, ${pal.colors[1]}, ${pal.colors[3]}, ${pal.colors[4]})`;
    b.appendChild(grad);
    b.addEventListener('click', () => {
      state.paletteKey = key;
      setPressedSwatch(key);
      draw(state.lastProgress); // instant recolor, no refetch, keep current frame
    });
    palettesGroup.appendChild(b);
  }
}
function setPressedSwatch(key) {
  palettesGroup.querySelectorAll('.swatch').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.pal === key)));
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = usernameInput.value.trim();
  if (name) load(name);
});

rangeGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  state.rangeMonths = Number(btn.dataset.months);
  setPressed(rangeGroup, 'months', state.rangeMonths);
  rebuild();
  play();
});

stylesGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  state.styleKey = btn.dataset.style;
  setPressed(stylesGroup, 'style', state.styleKey);
  state.schedule = computeSchedule(state.weeks, state.styleKey);
  play();
});

speedSlider.addEventListener('input', () => {
  state.speedMs = speedFromSlider(Number(speedSlider.value));
  speedValue.textContent = (state.speedMs / 1000).toFixed(1) + 's';
  play();
});

replayBtn.addEventListener('click', () => play());
exportBtn.addEventListener('click', () => {
  trackEvent('export_gif_click', { username: state.username, palette: state.paletteKey, style: state.styleKey });
  exportGif();
});

// ---------- exportable embed snippet ----------
// Two lines: one <script src> pulling the shared widget library
// (tools/gh-contrib-widget.js, a <gh-contrib-chart> custom element), and one
// tag configuring it with the current Range/Palette/Style/Speed selections.
// The library itself needs no backend — it fetches from jogruber.de directly.
function buildEmbedSnippet() {
  const palette = PALETTES[state.paletteKey].colors.join(',');
  const username = state.username || 'octocat';
  const widgetUrl = `${location.origin}/tools/gh-contrib-widget.js`;
  return `<script src="${widgetUrl}"><\/script>
<gh-contrib-chart
  username="${username}"
  range="${state.rangeMonths}"
  style="${state.styleKey}"
  speed="${state.speedMs}"
  palette="${palette}"
></gh-contrib-chart>`;
}

function openCodeModal() {
  codeOutput.textContent = buildEmbedSnippet();
  modalOverlay.hidden = false;
}
function closeCodeModal() { modalOverlay.hidden = true; }

getCodeBtn.addEventListener('click', () => {
  trackEvent('get_code_click', { username: state.username, palette: state.paletteKey, style: state.styleKey });
  openCodeModal();
});
modalClose.addEventListener('click', closeCodeModal);
modalClose2.addEventListener('click', closeCodeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeCodeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalOverlay.hidden) closeCodeModal(); });

copyCodeBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(codeOutput.textContent);
    copyCodeBtn.textContent = 'Copied!';
  } catch {
    copyCodeBtn.textContent = 'Press Cmd/Ctrl+C';
  }
  setTimeout(() => { copyCodeBtn.textContent = 'Copy code'; }, 1800);
});

// wait for fonts so canvas labels render in the right typeface
buildPaletteSwatches();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (!controls.hidden) draw(state.lastProgress); });
}

// deep-link support: ?u=username
const params = new URLSearchParams(location.search);
const preset = params.get('u') || params.get('username');
if (preset) { usernameInput.value = preset; load(preset); }
