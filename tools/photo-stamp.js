// Photo Stamp — photo -> rough pencil sketch -> circular rubber-stamp seal
// with a scalloped die-cut edge, exported as a transparent PNG.
// No build step: plain ES module, no dependencies, 100% client-side.

const WORK_SIZE = 640;   // working resolution for the sketch pipeline
const STAMP_SIZE = 760;  // final export canvas, square
const CX = STAMP_SIZE / 2;
const CY = STAMP_SIZE / 2;

const INNER_R = 288;        // sketch photo circle
const RING_R = 302;         // distressed ink ring (texture, not the die-cut edge)
const TEXT_R = 322;         // curved rim text baseline
const SCALLOP_R = 350;      // scalloped edge valley radius
const SCALLOP_BUMP = 16;    // how far each scallop bump pushes outward
const NUM_SCALLOPS = 26;    // number of rounded bumps around the rim
const SCALLOP_BAND_WIDTH = 9;
const NUM_RING_SEGMENTS = 90;

const INK_COLOR = '#2b2b2b';

// ---------- scalloped outer edge (the physical die-cut shape) ----------
// Fixed geometry, independent of photo/username, so it's built once here
// rather than per photo. Classic "cookie-cutter" technique: equally-spaced
// valley points on a base circle, with a quadratic curve bowed outward to a
// midpoint control point between each pair — repeated all the way around
// produces a closed rosette of smooth rounded bumps.
function buildScallopPath() {
  const path = new Path2D();
  const step = (Math.PI * 2) / NUM_SCALLOPS;
  const start = -Math.PI / 2;
  path.moveTo(CX + SCALLOP_R * Math.cos(start), CY + SCALLOP_R * Math.sin(start));
  for (let i = 0; i < NUM_SCALLOPS; i++) {
    const a0 = start + i * step;
    const a1 = a0 + step;
    const mid = a0 + step / 2;
    const ctrlX = CX + (SCALLOP_R + SCALLOP_BUMP) * Math.cos(mid);
    const ctrlY = CY + (SCALLOP_R + SCALLOP_BUMP) * Math.sin(mid);
    const nextX = CX + SCALLOP_R * Math.cos(a1);
    const nextY = CY + SCALLOP_R * Math.sin(a1);
    path.quadraticCurveTo(ctrlX, ctrlY, nextX, nextY);
  }
  path.closePath();
  return path;
}
const SCALLOP_PATH = buildScallopPath();

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const chooseLabel = $('chooseLabel');
const changeBtn = $('changeBtn');
const hint = $('hint');
const stateEl = $('state');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const controls = $('controls');
const usernameInput = $('username');
const exportBtn = $('exportBtn');

// ---------- state ----------
const state = {
  photoLoaded: false,
  username: '',
  year: new Date().getFullYear(),
  workCanvas: null,       // WORK_SIZE square, cropped/downsampled source photo
  sketchCanvas: null,     // transparent-bg edge-detected linework
  baseLayerCanvas: null,  // sketch clipped into the inner circle, STAMP_SIZE square
  ringSeed: [],           // precomputed jitter/skip per ring segment, stable across re-renders
};

// ---------- UI states ----------
function setUIState(mode, message) {
  stateEl.classList.remove('error');
  if (mode === 'empty') {
    stateEl.hidden = false;
    stateEl.textContent = 'start by choosing or taking a photo above';
    canvas.hidden = true;
    controls.hidden = true;
    chooseLabel.hidden = false;
    changeBtn.hidden = true;
    hint.textContent = 'upload a photo, or take one on your phone';
  } else if (mode === 'processing') {
    stateEl.hidden = false;
    stateEl.innerHTML = '<span class="spinner"></span>Sketching your photo…';
    canvas.hidden = true;
    controls.hidden = true;
  } else if (mode === 'ready') {
    stateEl.hidden = true;
    canvas.hidden = false;
    controls.hidden = false;
    chooseLabel.hidden = true;
    changeBtn.hidden = false;
    hint.textContent = 'type a name, then export';
  } else if (mode === 'error') {
    stateEl.hidden = false;
    stateEl.classList.add('error');
    stateEl.textContent = message || 'Could not read that photo — try a different one.';
    canvas.hidden = true;
    controls.hidden = true;
    chooseLabel.hidden = false;
    changeBtn.hidden = true;
  }
}

// ---------- load & normalize ----------
async function loadAndNormalize(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, w: bitmap.width, h: bitmap.height };
  } catch {
    // Older browsers without createImageBitmap EXIF support: fall back to a
    // plain <img>. EXIF rotation won't be auto-corrected here — acceptable,
    // known limitation on old browsers, not solved further.
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('could not decode image'));
      im.src = objectUrl;
    });
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, objectUrl };
  }
}

function cropToSquareWorkingCanvas(source, sw, sh) {
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  const work = document.createElement('canvas');
  work.width = WORK_SIZE;
  work.height = WORK_SIZE;
  work.getContext('2d').drawImage(source, sx, sy, side, side, 0, 0, WORK_SIZE, WORK_SIZE);
  return work;
}

// ---------- sketch effect (Sobel edge detection) ----------
function smoothstep(lo, hi, x) {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

function sketchify(workCanvas) {
  const w = workCanvas.width, h = workCanvas.height;
  const src = workCanvas.getContext('2d').getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < src.data.length; i += 4, p++) {
    gray[p] = 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2];
  }

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const outData = octx.createImageData(w, h);

  const LO = 28, HI = 130;
  const [inkR, inkG, inkB] = [0x2b, 0x2b, 0x2b];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] + gray[i - w + 1] +
        -2 * gray[i - 1] + 2 * gray[i + 1] +
        -gray[i + w - 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      const alpha = smoothstep(LO, HI, mag);
      const o = i * 4;
      outData.data[o] = inkR;
      outData.data[o + 1] = inkG;
      outData.data[o + 2] = inkB;
      outData.data[o + 3] = Math.round(alpha * 255);
    }
  }
  octx.putImageData(outData, 0, 0);
  return out;
}

function buildBaseLayer(sketchCanvas) {
  const layer = document.createElement('canvas');
  layer.width = STAMP_SIZE;
  layer.height = STAMP_SIZE;
  const lctx = layer.getContext('2d');
  lctx.save();
  lctx.beginPath();
  lctx.arc(CX, CY, INNER_R, 0, Math.PI * 2);
  lctx.clip();
  const d = INNER_R * 2;
  lctx.drawImage(sketchCanvas, CX - INNER_R, CY - INNER_R, d, d);
  lctx.restore();
  return layer;
}

function buildRingSeed(count) {
  const seed = [];
  for (let i = 0; i < count; i++) {
    seed.push({ jitter: (Math.random() - 0.5) * 3, skip: Math.random() < 0.1 });
  }
  return seed;
}

// ---------- rendering ----------
function drawDistressedRing(context, seed) {
  const n = seed.length;
  const step = (Math.PI * 2) / n;
  context.strokeStyle = INK_COLOR;
  context.lineWidth = 3;
  context.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    if (seed[i].skip) continue;
    const a0 = i * step;
    const a1 = a0 + step * 0.9; // small inherent gap for ink texture
    const rr = RING_R + seed[i].jitter;
    context.beginPath();
    context.arc(CX, CY, rr, a0, a1);
    context.stroke();
  }
}

function rimTextString() {
  const name = state.username.trim();
  return `${state.year} — ${(name || 'YOURNAME').toUpperCase()}`;
}

// Curved rim text: measures each character, converts arc length to angle,
// and rotates incrementally around the circle starting from top-center.
// Shrinks font size (down to a floor) if the string would wrap too far
// around toward the bottom, where letters would start reading upside down.
function drawRimText(context, radius, text) {
  if (!text) return;
  const MAX_ARC = 2.6; // radians (~150deg) kept near the top of the circle
  const MIN_FONT = 14;
  let fontSize = 30;
  let chars, widths, angles, totalAngle;

  for (;;) {
    context.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
    chars = [...text];
    widths = chars.map((ch) => context.measureText(ch).width + fontSize * 0.08);
    angles = widths.map((w) => w / radius);
    totalAngle = angles.reduce((a, b) => a + b, 0);
    if (totalAngle <= MAX_ARC || fontSize <= MIN_FONT) break;
    fontSize -= 2;
  }

  context.save();
  context.translate(CX, CY);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = INK_COLOR;

  let theta = -totalAngle / 2;
  for (let i = 0; i < chars.length; i++) {
    const half = angles[i] / 2;
    theta += half;
    context.save();
    context.rotate(theta);
    context.translate(0, -radius);
    context.fillText(chars[i], 0, 0);
    context.restore();
    theta += half;
  }
  context.restore();
}

function drawStampOverlay() {
  ctx.clearRect(0, 0, STAMP_SIZE, STAMP_SIZE);
  ctx.save();
  ctx.clip(SCALLOP_PATH); // outer silhouette for everything that follows
  if (state.baseLayerCanvas) ctx.drawImage(state.baseLayerCanvas, 0, 0);
  if (state.ringSeed.length) drawDistressedRing(ctx, state.ringSeed);
  ctx.lineWidth = SCALLOP_BAND_WIDTH;
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke(SCALLOP_PATH);
  drawRimText(ctx, TEXT_R, rimTextString());
  ctx.restore();
}

// ---------- flow ----------
async function handleFileSelected(file) {
  if (!file) return;
  setUIState('processing');
  let objectUrl = null;
  try {
    const loaded = await loadAndNormalize(file);
    objectUrl = loaded.objectUrl || null;
    state.workCanvas = cropToSquareWorkingCanvas(loaded.source, loaded.w, loaded.h);
    state.sketchCanvas = sketchify(state.workCanvas);
    state.baseLayerCanvas = buildBaseLayer(state.sketchCanvas);
    state.ringSeed = buildRingSeed(NUM_RING_SEGMENTS);
    state.photoLoaded = true;
    drawStampOverlay();
    setUIState('ready');
  } catch (e) {
    console.error('[photo-stamp] failed to process photo', e);
    setUIState('error', 'Could not read that photo — try a different one.');
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function resetForNewPhoto() {
  state.photoLoaded = false;
  state.workCanvas = null;
  state.sketchCanvas = null;
  state.baseLayerCanvas = null;
  state.ringSeed = [];
  setUIState('empty');
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = ''; // allow re-selecting the same file later
  handleFileSelected(file);
});

changeBtn.addEventListener('click', resetForNewPhoto);

let debounceTimer = null;
usernameInput.addEventListener('input', () => {
  state.username = usernameInput.value;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (state.photoLoaded) drawStampOverlay();
  }, 120);
});

function sanitizeFilename(s) {
  return s.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

exportBtn.addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stamp-${sanitizeFilename(state.username) || 'stamp'}-${state.year}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
});

setUIState('empty');
