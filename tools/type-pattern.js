// Type Pattern — every keystroke drops a shape into a grid, colour and form
// keyed off the character. No build step: plain ES module, no dependencies.

const CELL = 34;                 // grid cell size, CSS px
const POP_MS = 260;              // per-shape pop-in duration
const CURSOR_BLINK_MS = 900;

const COLORS = ['#3f7ff4', '#5a2ea6', '#e2652a', '#30a14e', '#d63384', '#141414'];

const canvas = document.getElementById('canvas');
const stageInner = canvas.parentElement;
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const clearBtn = document.getElementById('clear');

let dpr = window.devicePixelRatio || 1;
let width = 0, height = 0;
let cols = 0, rows = 0;
let cells = [];          // flat array, index = row*cols+col -> {kind, colorIdx, seed, spawn} | null
let cursor = 0;          // flat index of the next cell to fill
let hasTyped = false;

function classify(ch) {
  if (/[a-zA-Z]/.test(ch)) return 'circle';
  if (/[0-9]/.test(ch)) return 'triangle';
  return 'diamond';
}

// deterministic small jitter per cell so re-renders (e.g. on resize) stay stable
function seedFor(code, idx) {
  const x = Math.sin(code * 12.9898 + idx * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makeGrid() {
  const rect = stageInner.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  cols = Math.max(1, Math.floor(width / CELL));
  rows = Math.max(1, Math.floor(height / CELL));
  cells = new Array(cols * rows).fill(null);
  cursor = 0;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function advanceCursor() {
  cursor = (cursor + 1) % (cols * rows);
}

function placeChar(ch) {
  const code = ch.charCodeAt(0);
  const kind = classify(ch);
  cells[cursor] = {
    kind,
    colorIdx: code % COLORS.length,
    seed: seedFor(code, cursor),
    spawn: performance.now(),
  };
  advanceCursor();
}

function placeSpace() {
  cells[cursor] = null;
  advanceCursor();
}

function backspace() {
  cursor = (cursor - 1 + cols * rows) % (cols * rows);
  cells[cursor] = null;
}

function newline() {
  const col = cursor % cols;
  if (col !== 0) cursor += (cols - col);
  cursor = cursor % (cols * rows);
}

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function drawShape(kind, cx, cy, size, colorIdx, jitter) {
  const angle = (jitter - 0.5) * 0.5; // slight rotation, +-~14deg
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = COLORS[colorIdx];
  const s = size / 2;
  if (kind === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.95, s * 0.8);
    ctx.lineTo(-s * 0.95, s * 0.8);
    ctx.closePath();
    ctx.fill();
  } else { // diamond
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell) continue;
    const col = i % cols, row = Math.floor(i / cols);
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;
    const t = Math.min(1, (now - cell.spawn) / POP_MS);
    const scale = easeOutBack(t);
    const baseSize = CELL * (0.5 + cell.seed * 0.16);
    drawShape(cell.kind, cx, cy, Math.max(0, baseSize * scale), cell.colorIdx, cell.seed);
  }

  // blinking cursor cell outline
  if (hasTyped) {
    const blink = Math.floor(now / CURSOR_BLINK_MS) % 2 === 0;
    if (blink) {
      const col = cursor % cols, row = Math.floor(cursor / cols);
      ctx.strokeStyle = 'rgba(63,127,244,0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
    }
  }
}

function tick(now) {
  draw(now);
  requestAnimationFrame(tick);
}

window.addEventListener('keydown', (e) => {
  // ignore modified combos (copy/paste/devtools/etc.) and non-character keys
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === 'Backspace') {
    e.preventDefault();
    backspace();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    newline();
  } else if (e.key === ' ') {
    e.preventDefault();
    placeSpace();
  } else if (e.key.length === 1) {
    placeChar(e.key);
  } else {
    return; // Tab, arrows, Shift, Escape, etc. — leave untouched
  }
  if (!hasTyped) {
    hasTyped = true;
    placeholder.hidden = true;
  }
});

clearBtn.addEventListener('click', () => {
  cells.fill(null);
  cursor = 0;
  hasTyped = false;
  placeholder.hidden = false;
});

let resizeTimer = null;
const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { dpr = window.devicePixelRatio || 1; makeGrid(); }, 120);
});
ro.observe(stageInner);

requestAnimationFrame(tick);
