// Elastic Grid — a mass-spring mesh drawn with position-based Verlet
// integration. Structural springs pull each point toward its neighbours,
// a weak "home" spring (see spring.js) pulls it back to its original grid
// position. No build step: plain ES modules, no dependencies.

import { stepSpring } from './spring.js';

const SPACING = 46;        // target distance between points, CSS px
const STIFFNESS = 0.55;    // neighbour-constraint correction per iteration [0..1]
const ITERATIONS = 3;      // constraint relaxation passes per frame
const DAMPING = 0.965;     // velocity retained per frame (Verlet drag)
const HOME_PULL = 0.012;   // fraction pulled back toward rest position per frame
const GRAB_RADIUS = 70;    // how far the pointer can be from a point to grab it
const DOT_R = 3;
const ACCENT = '#3f7ff4';
const LINE = 'rgba(20,20,20,0.14)';
const LINE_ACTIVE = 'rgba(63,127,244,0.5)';

const canvas = document.getElementById('canvas');
const stageInner = canvas.parentElement;
const ctx = canvas.getContext('2d');
const pokeBtn = document.getElementById('poke');

let dpr = window.devicePixelRatio || 1;
let width = 0, height = 0;
let cols = 0, rows = 0;
let points = [];      // flat array, index = row*cols+col
let edges = [];        // {a, b, rest}
let dragIndex = -1;
let pointerX = 0, pointerY = 0;

function makeGrid() {
  const rect = stageInner.getBoundingClientRect();
  width = rect.width;
  height = rect.height;

  cols = Math.max(2, Math.round(width / SPACING) + 1);
  rows = Math.max(2, Math.round(height / SPACING) + 1);
  const stepX = width / (cols - 1);
  const stepY = height / (rows - 1);

  points = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * stepX;
      const y = r * stepY;
      points.push({ x, y, px: x, py: y, homeX: x, homeY: y, pinned: false });
    }
  }

  edges = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c < cols - 1) edges.push({ a: i, b: i + 1, rest: stepX });
      if (r < rows - 1) edges.push({ a: i, b: i + cols, rest: stepY });
    }
  }

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function nearestPoint(x, y) {
  let best = -1, bestDist = GRAB_RADIUS;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function step() {
  // integrate free points
  for (const p of points) {
    if (p.pinned) continue;
    [p.x, p.px] = stepSpring(p.x, p.px, p.homeX, DAMPING, HOME_PULL);
    [p.y, p.py] = stepSpring(p.y, p.py, p.homeY, DAMPING, HOME_PULL);
  }

  // drag pinned point smoothly toward the actual pointer position, one step
  // per frame — this is what gives the released point real velocity to fling.
  if (dragIndex !== -1) {
    const p = points[dragIndex];
    p.px = p.x;
    p.py = p.y;
    p.x = pointerX;
    p.y = pointerY;
  }

  // relax structural constraints
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const e of edges) {
      const a = points[e.a], b = points[e.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const diff = ((dist - e.rest) / dist) * STIFFNESS;
      const ox = dx * diff * 0.5, oy = dy * diff * 0.5;
      if (!a.pinned) { a.x += ox; a.y += oy; }
      if (!b.pinned) { b.x -= ox; b.y -= oy; }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  ctx.lineWidth = 1;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  for (const e of edges) {
    const a = points[e.a], b = points[e.b];
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  if (dragIndex !== -1) {
    ctx.strokeStyle = LINE_ACTIVE;
    ctx.beginPath();
    for (const e of edges) {
      if (e.a !== dragIndex && e.b !== dragIndex) continue;
      const a = points[e.a], b = points[e.b];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === dragIndex ? DOT_R * 1.8 : DOT_R, 0, Math.PI * 2);
    ctx.fillStyle = i === dragIndex ? ACCENT : '#141414';
    ctx.fill();
  }
}

function tick() {
  step();
  draw();
  requestAnimationFrame(tick);
}

function localPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = localPos(e);
  const idx = nearestPoint(x, y);
  if (idx === -1) return;
  dragIndex = idx;
  points[idx].pinned = true;
  pointerX = x; pointerY = y;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (dragIndex === -1) return;
  const { x, y } = localPos(e);
  pointerX = x; pointerY = y;
});

function release() {
  if (dragIndex === -1) return;
  points[dragIndex].pinned = false;
  dragIndex = -1;
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', (e) => {
  // only release on leave if the pointer isn't captured (i.e. not actively dragging)
  if (dragIndex !== -1 && !canvas.hasPointerCapture(e.pointerId)) release();
});

pokeBtn.addEventListener('click', () => {
  const impulses = 3 + Math.floor(Math.random() * 3);
  for (let n = 0; n < impulses; n++) {
    const i = Math.floor(Math.random() * points.length);
    const p = points[i];
    const angle = Math.random() * Math.PI * 2;
    const mag = 30 + Math.random() * 40;
    p.px = p.x - Math.cos(angle) * mag;
    p.py = p.y - Math.sin(angle) * mag;
  }
});

// ResizeObserver's callback fires once immediately with the current size (and
// again on real resizes), which sidesteps relying on layout being settled by
// the time this module script runs.
let resizeTimer = null;
const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { dpr = window.devicePixelRatio || 1; makeGrid(); }, 120);
});
ro.observe(stageInner);

requestAnimationFrame(tick);
