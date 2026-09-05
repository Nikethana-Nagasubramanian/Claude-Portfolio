// Scramble Text — hover a word and it decodes back from random characters,
// left to right, each letter settling at a slightly different moment.
// No build step: plain ES module, no dependencies.

const PHRASE = 'WORDS THAT REBUILD THEMSELVES';
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+=-/\\<>';
const DURATION = 850;

const headline = document.getElementById('headline');
const replayBtn = document.getElementById('replay');

const words = PHRASE.split(' ').map((text) => {
  const el = document.createElement('span');
  el.className = 'word';
  el.dataset.text = text;
  el.textContent = text;
  el.token = 0;
  return el;
});

words.forEach((el, i) => {
  headline.appendChild(el);
  if (i < words.length - 1) headline.appendChild(document.createTextNode(' '));
});

function randomChar() {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function scramble(el) {
  const text = el.dataset.text;
  const len = text.length;
  const myToken = ++el.token;
  const start = performance.now();
  // each character settles somewhere between 30%-100% of the duration,
  // biased left-to-right so it reads as a decode rather than random noise
  const settleAt = [...text].map((ch, i) =>
    ch === ' ' ? 0 : (i / len) * DURATION * 0.6 + Math.random() * DURATION * 0.4
  );

  function frame(now) {
    if (el.token !== myToken) return; // superseded by a newer trigger
    const t = now - start;
    let out = '';
    let allSettled = true;
    for (let i = 0; i < len; i++) {
      const ch = text[i];
      if (ch === ' ') { out += ' '; continue; }
      if (t >= settleAt[i]) out += ch;
      else { out += randomChar(); allSettled = false; }
    }
    el.textContent = out;
    if (!allSettled) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

words.forEach((el) => el.addEventListener('mouseenter', () => scramble(el)));

function playAll() {
  words.forEach((el, i) => setTimeout(() => scramble(el), i * 140));
}

replayBtn.addEventListener('click', playAll);

// stagger an intro pass once fonts are ready
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => setTimeout(playAll, 200));
} else {
  setTimeout(playAll, 200);
}
