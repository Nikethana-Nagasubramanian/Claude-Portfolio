// Elastic Carousel — same spring (see spring.js) as the mesh grid, applied to
// a single value instead of a few hundred: the track's x offset. Dragging
// pins the track to the pointer directly; releasing it hands off to the
// spring, which eases toward the nearest slide and carries whatever velocity
// the drag left behind. Past the first/last slide the drag is rubber-banded
// so the ends feel like limits, not walls.

import { stepSpring } from './spring.js';

const GAP = 16;             // px between slides
const SLIDE_FRACTION = 0.82; // slide width as a fraction of viewport width
const DAMPING = 0.9;        // velocity retained per frame while settling
const PULL = 0.16;          // fraction pulled toward the target slide per frame
const RUBBER = 0.35;        // how much drag beyond the ends is resisted
const FLICK_VELOCITY = 6;   // px/frame beyond which a fast drag counts as a flick

const root = document.getElementById('carousel');
const viewport = root.querySelector('.car-viewport');
const track = document.getElementById('carTrack');
const slides = Array.from(track.children);
const dotsEl = document.getElementById('carDots');

let viewportWidth = 0;
let slideWidth = 0;
let step = 0; // slideWidth + GAP
let index = 0;

let pos = 0, px = 0, target = 0;
let dragging = false;
let dragStartX = 0, dragStartPos = 0;

function restX(i) {
  return viewportWidth / 2 - slideWidth / 2 - i * step;
}

function bounds() {
  return { min: restX(slides.length - 1), max: restX(0) };
}

function measure() {
  viewportWidth = viewport.getBoundingClientRect().width;
  slideWidth = viewportWidth * SLIDE_FRACTION;
  step = slideWidth + GAP;
  for (const s of slides) s.style.width = `${slideWidth}px`;
  target = restX(index);
  pos = px = target;
  render();
}

function render() {
  track.style.transform = `translate3d(${pos}px,0,0)`;
  for (let i = 0; i < slides.length; i++) {
    const dist = Math.abs(i - (-pos / step));
    slides[i].style.opacity = Math.max(0.35, 1 - dist * 0.5);
  }
  for (let i = 0; i < dotsEl.children.length; i++) {
    dotsEl.children[i].classList.toggle('active', i === index);
  }
}

function goTo(i) {
  index = Math.max(0, Math.min(slides.length - 1, i));
  target = restX(index);
}

function tick() {
  if (!dragging) {
    [pos, px] = stepSpring(pos, px, target, DAMPING, PULL);
  }
  render();
  requestAnimationFrame(tick);
}

function localX(e) {
  return e.clientX;
}

track.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragStartX = localX(e);
  dragStartPos = pos;
  px = pos;
  track.setPointerCapture(e.pointerId);
  root.classList.add('dragging');
});

track.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = localX(e) - dragStartX;
  let next = dragStartPos + dx;
  const { min, max } = bounds();
  if (next > max) next = max + (next - max) * RUBBER;
  if (next < min) next = min + (next - min) * RUBBER;
  px = pos;
  pos = next;
});

function endDrag() {
  if (!dragging) return;
  dragging = false;
  root.classList.remove('dragging');
  const velocity = pos - px;
  if (Math.abs(velocity) > FLICK_VELOCITY) {
    goTo(index - Math.sign(velocity));
  } else {
    goTo(Math.round(-pos / step));
  }
}

track.addEventListener('pointerup', endDrag);
track.addEventListener('pointercancel', endDrag);

track.addEventListener('dragstart', (e) => e.preventDefault());

root.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') goTo(index - 1);
  if (e.key === 'ArrowRight') goTo(index + 1);
});

for (let i = 0; i < slides.length; i++) {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'dot';
  dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
  dot.addEventListener('click', () => goTo(i));
  dotsEl.appendChild(dot);
}

let resizeTimer = null;
const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(measure, 120);
});
ro.observe(viewport);

measure();
requestAnimationFrame(tick);
