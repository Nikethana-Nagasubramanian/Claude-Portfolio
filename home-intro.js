(() => {
  const intro = document.querySelector('.home-intro');
  if (!intro) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = () => {
    window.setTimeout(() => intro.classList.add('is-dealing'), 1500);
    // 1.5s welcome hold, then 520ms throws with overlap, a 260ms stack hold,
    // and a one-by-one descent into the page below.
    window.setTimeout(() => intro.classList.add('is-descending'), 1500 + 520 + 260);
    window.setTimeout(() => intro.classList.add('is-resolved'), 1500 + 520 + 260 + 680 + 480 + 220);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(start, 260), { once:true });
  else window.setTimeout(start, 260);
})();
