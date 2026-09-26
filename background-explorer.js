/* A native modal keeps the portfolio mounted and makes it inert while exploring. */
(() => {
  if (!document.body.classList.contains('has-rail')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'background-explorer';
  dialog.id = 'background-explorer';
  dialog.setAttribute('aria-label', 'Explore the background');
  dialog.innerHTML = `<button type="button" class="background-explorer__close">Back to portfolio <span aria-hidden="true">×</span></button>
    <figure class="background-explorer__art">
      <img class="background-explorer__image" width="1672" height="941" alt="">
      <div class="background-explorer__cities" aria-label="Cities in the illustration">
        <button type="button" data-city="Chennai" aria-expanded="false" aria-controls="background-city-note">Chennai</button>
        <button type="button" data-city="Boston" aria-expanded="false" aria-controls="background-city-note">Boston</button>
        <button type="button" data-city="New Orleans" aria-expanded="false" aria-controls="background-city-note">New Orleans</button>
      </div>
      <figcaption class="background-explorer__caption"></figcaption>
      <p id="background-city-note" class="background-explorer__note" role="status" hidden></p>
    </figure>`;
  document.body.append(dialog);
  const close = dialog.querySelector('.background-explorer__close');
  const picture = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const cities = dialog.querySelector('.background-explorer__cities');
  const note = dialog.querySelector('.background-explorer__note');
  const notes = {
    Chennai: 'Chennai · A nod to the city and its temple architecture. Two temples I love: Parthasarathy and Thiruvallarai (outside Chennai). The illustration is not a depiction of one specific temple.',
    Boston: 'Boston · 2022–2026. I moved here in 2022; its skyline marks the next chapter.',
    'New Orleans': 'New Orleans · 2026–present. My newest chapter—and where I live now.'
  };
  let trigger, savedScroll = [0, 0], motion;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function fade(target, instant, done) {
    const opacity = getComputedStyle(dialog).opacity;
    motion?.cancel();
    motion = null;
    dialog.style.opacity = target;
    if (instant || reducedMotion.matches) { done?.(); return; }
    const animation = dialog.animate([{ opacity }, { opacity: target }], {
      duration: target === 1 ? 240 : 160,
      easing: 'cubic-bezier(.23,1,.32,1)'
    });
    motion = animation;
    animation.finished.then(() => {
      if (motion !== animation) return;
      motion = null;
      done?.();
    }).catch(() => {}); // A new interaction can interrupt the current motion.
  }
  function dismiss(instant = false) {
    if (dialog.open) fade(0, instant, () => dialog.close());
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-explore-background]');
    if (!button || dialog.open) return;
    trigger = button;
    savedScroll = [window.scrollX, window.scrollY];
    const rect = button.getBoundingClientRect();
    close.style.left = Math.max(16, Math.min(rect.left, window.innerWidth - 210)) + 'px';
    close.style.top = Math.max(16, Math.min(rect.top, window.innerHeight - 64)) + 'px';
    const night = document.documentElement.dataset.theme === 'dark';
    dialog.dataset.scene = night ? 'night' : 'day';
    picture.src = night ? 'assets/atmosphere/night-nebula.png' : 'assets/atmosphere/day-sky.png';
    picture.alt = night ? 'A blue and purple galaxy inspired by Rick and Morty.' : 'Chennai temple and waterfront on the left, the Boston skyline in the center, and New Orleans on the right.';
    cities.hidden = night;
    caption.textContent = night ? 'A galaxy inspired by Rick and Morty.' : 'Chennai → Boston → New Orleans';
    note.hidden = true;
    cities.querySelectorAll('button').forEach(item => item.setAttribute('aria-expanded', 'false'));
    button.setAttribute('aria-expanded', 'true');
    dialog.style.opacity = 0;
    dialog.showModal();
    document.body.classList.add('exploring-background');
    close.focus({ preventScroll: true });
    fade(1, event.detail === 0);
  });
  cities.addEventListener('click', event => {
    const button = event.target.closest('[data-city]');
    if (!button) return;
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    cities.querySelectorAll('button').forEach(item => item.setAttribute('aria-expanded', String(expanded && item === button)));
    note.textContent = notes[button.dataset.city];
    note.hidden = !expanded;
  });
  close.addEventListener('click', event => dismiss(event.detail === 0));
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(true); });
  dialog.addEventListener('close', () => {
    motion?.cancel();
    motion = null;
    document.body.classList.remove('exploring-background');
    if (trigger?.isConnected) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus({ preventScroll: true });
    }
    window.scrollTo({left:savedScroll[0], top:savedScroll[1], behavior:'instant'});
  });
  window.addEventListener('popstate', () => { if (dialog.open) dialog.close(); });
  document.addEventListener('site:routechange', () => { if (dialog.open) dialog.close(); });
})();
