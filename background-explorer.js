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
        <article class="background-explorer__city" data-city="Chennai">
          <img class="background-explorer__sticker" src="assets/atmosphere/coffee.png" width="130" height="130" alt="" />
          <h2>Chennai, Tamil Nadu, India</h2>
          <p>Chennai is my home; if you’re ever visiting the city, I’d recommend trying filter coffee (kaapi if I’m being accurate) and seeing Marina Beach!</p>
        </article>
        <article class="background-explorer__city" data-city="Boston">
          <img class="background-explorer__sticker" src="assets/atmosphere/grad-cap.png" width="130" height="130" alt="" />
          <h2>Boston, MA</h2>
          <p>Boston became my 2nd home when I moved here in 2022. I did my master’s, found my people.</p>
        </article>
        <article class="background-explorer__city" data-city="New Orleans">
          <img class="background-explorer__sticker" src="assets/atmosphere/alligator.png" width="130" height="130" alt="" />
          <h2>New Orleans, LA</h2>
          <p>Currently hereee! Kayaking with the alligators. And no, they’re not as cute as the sticker, bruh.</p>
        </article>
      </div>
      <figcaption class="background-explorer__caption"></figcaption>
    </figure>`;
  document.body.append(dialog);
  const close = dialog.querySelector('.background-explorer__close');
  const picture = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const cities = dialog.querySelector('.background-explorer__cities');
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
    const night = document.documentElement.dataset.theme === 'dark';
    dialog.dataset.scene = night ? 'night' : 'day';
    picture.src = night ? 'assets/atmosphere/night-nebula.png' : 'assets/atmosphere/day-sky.png';
    picture.alt = night ? 'A blue and purple galaxy inspired by Rick and Morty.' : 'Chennai temple and waterfront on the left, the Boston skyline in the center, and New Orleans on the right.';
    cities.hidden = night;
    dialog.dataset.animateCities = String(!night && event.detail !== 0 && !reducedMotion.matches);
    caption.textContent = night ? 'A galaxy inspired by Rick and Morty.' : '';
    caption.hidden = !night;
    close.textContent = 'Click here to go back to portfolio';
    button.setAttribute('aria-expanded', 'true');
    dialog.style.opacity = 0;
    dialog.showModal();
    document.body.classList.add('exploring-background');
    close.focus({ preventScroll: true });
    fade(1, event.detail === 0);
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
