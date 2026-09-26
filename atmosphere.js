/* Decorative, opt-in scenery. Theme state continues to belong to site-theme.js. */
(() => {
  const body = document.body;
  if (!body.classList.contains('has-rail')) return;
  const scene = document.createElement('div');
  scene.className = 'atmosphere';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `<div class="atmosphere__day"></div><div class="atmosphere__night"></div>
    <div class="atmosphere__sparkles">${[[86,14,0],[94,46,2],[73,78,4],[64,9,1],[91,87,5],[47,91,3]].map(([x,y,d]) => `<i class="atmosphere__star" style="left:${x}%;top:${y}%;animation-delay:-${d}s"></i>`).join('')}</div>`;
  body.prepend(scene);

  const visibility = () => body.classList.toggle('atmosphere-inactive', document.hidden);
  document.addEventListener('visibilitychange', visibility);
  visibility();
})();
