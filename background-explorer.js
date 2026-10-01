/* A native modal keeps the portfolio mounted and makes it inert while exploring. */
(() => {
  if (!document.body.classList.contains('has-rail')) return;
  const places = [
    {
      id: 'chennai', name: 'Chennai', heading: 'Chennai, Tamil Nadu', sticker: 'coffee.png',
      image: 'Chennai temple gopuram with palms-2.png', width: 1536, height: 1024, groundRight: 1520, groundBottom: 987,
      paragraphs: [
        'Chennai is home. It taught me to notice the small rituals that make a place feel familiar: filter kaapi poured between steel tumblers, the salt air along Marina Beach, and conversations that stretch longer than planned. These things earn their place in your life through consistency, care, and time.',
        'I think technology earns trust the same way. Through clear choices, honest feedback, and the quiet reliability of doing what it promised. That belief shapes how I design, code, and continue learning.',
        'If you ever visit Chennai, start with a filter kaapi and end the day at Marina.'
      ]
    },
    {
      id: 'boston', name: 'Boston', heading: 'Boston, Massachusetts', sticker: 'grad-cap.png',
      image: 'Pastel Boston Skyline with Prudential Tower-1.png', width: 2106, height: 747, groundRight: 2086, groundBottom: 712,
      paragraphs: [
        'Boston taught me that opportunities rarely arrive when you feel completely ready. I learned to make the ask, build the prototype, and take the first step before I knew exactly where it would lead.',
        '“Ask for forgiveness, not permission” became less about breaking rules and more about trusting myself enough to begin—especially when the decision was reversible and waiting only protected me from being seen.'
      ]
    },
    {
      id: 'nola', name: 'New Orleans', heading: 'New Orleans, Louisiana', sticker: 'alligator.png',
      image: 'Pastel New Orleans Cathedral Skyline-3.png', width: 1536, height: 1024, groundRight: 1519, groundBottom: 987,
      paragraphs: [
        'New Orleans is teaching me to leave room for serendipity. And learning to kayak with the alligators; and no they’re not as cute as the sticker.'
      ]
    }
  ];
  const dialog = document.createElement('dialog');
  dialog.className = 'background-explorer';
  dialog.id = 'background-explorer';
  dialog.setAttribute('aria-label', 'Explore the background');
  dialog.innerHTML = `<button type="button" class="background-explore background-explorer__close">Return to portfolio</button>
    <figure class="background-explorer__art">
      <div class="background-explorer__sky" aria-hidden="true"></div>
      <img class="background-explorer__image" width="1672" height="941" alt="">
      <div class="background-explorer__hotspots" role="group" aria-label="Explore a place">
        ${places.map(place => `<button type="button" class="background-explorer__hotspot" data-place="${place.id}" aria-label="Explore ${place.name}" aria-controls="explorer-story-${place.id}"><span>${place.name} <b aria-hidden="true">↗</b></span></button>`).join('')}
      </div>
      <div class="background-explorer__landmarks" aria-hidden="true">
        ${places.map(place => `<img class="background-explorer__landmark" data-landmark="${place.id}" src="assets/atmosphere/${place.image}" width="${place.width}" height="${place.height}" alt="">`).join('')}
      </div>
      <div class="background-explorer__stories">
        ${places.map(place => `<article class="background-explorer__story" id="explorer-story-${place.id}" aria-labelledby="explorer-title-${place.id}" hidden>
          <header><h2 id="explorer-title-${place.id}" tabindex="-1">${place.heading}</h2>
          <img class="background-explorer__sticker" src="assets/atmosphere/${place.sticker}" width="100" height="100" alt=""></header>
          ${place.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}
        </article>`).join('')}
      </div>
      <figcaption class="background-explorer__caption"></figcaption>
    </figure>
    <nav class="background-explorer__switcher" aria-label="Choose a place">
      <button type="button" data-place="all" aria-pressed="true">All places</button>
      ${places.map(place => `<button type="button" data-place="${place.id}" aria-pressed="false" aria-controls="explorer-story-${place.id}">${place.name}</button>`).join('')}
    </nav>`;
  document.body.append(dialog);
  const close = dialog.querySelector('.background-explorer__close');
  const picture = dialog.querySelector('.background-explorer__image');
  const caption = dialog.querySelector('figcaption');
  const hotspots = dialog.querySelector('.background-explorer__hotspots');
  const switcher = dialog.querySelector('.background-explorer__switcher');
  const sky = dialog.querySelector('.background-explorer__sky');
  const stories = dialog.querySelector('.background-explorer__stories');
  const art = dialog.querySelector('.background-explorer__art');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 980px)');
  const handwriting = document.createElement('link');
  handwriting.rel = 'stylesheet';
  handwriting.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&display=swap';
  document.head.append(handwriting);
  const scenes = {
    day: 'assets/atmosphere/day-sky.png',
    night: 'assets/atmosphere/night-nebula.png'
  };
  // Warm both decoded images after load, without delaying input or first paint.
  const preloaded = [];
  function preload() {
    const warm = () => [...Object.values(scenes), ...places.map(place => 'assets/atmosphere/' + place.image)].forEach(src => {
      const image = new Image();
      image.src = src;
      preloaded.push(image);
      image.decode?.().catch(() => {});
    });
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2000 });
    else setTimeout(warm, 0);
  }
  if (document.readyState === 'complete') preload();
  else window.addEventListener('load', preload, { once: true });

  let trigger, savedScroll = [0, 0], motions = [], targetOpen = false;
  let activePlace = null;
  const placeMotions = new Map();
  const landmarks = places.map(place => ({
    ...place,
    element: dialog.querySelector(`[data-landmark="${place.id}"]`),
    hotspot: hotspots.querySelector(`[data-place="${place.id}"]`),
    story: document.getElementById('explorer-story-' + place.id)
  }));

  // Read the presentation value before cancelling, so rapid city changes
  // continue from the visible frame instead of jumping to an old endpoint.
  function moveLayer(element, next, instant = false) {
    const computed = getComputedStyle(element);
    const from = {};
    for (const property of Object.keys(next)) from[property] = computed[property];
    placeMotions.get(element)?.cancel();
    Object.assign(element.style, next);
    if (instant || reducedMotion.matches) { placeMotions.delete(element); return; }
    const animation = element.animate([from, next], {
      duration: 520, easing: 'cubic-bezier(.22,1,.36,1)'
    });
    placeMotions.set(element, animation);
    animation.onfinish = () => {
      if (placeMotions.get(element) === animation) placeMotions.delete(element);
    };
  }

  function landmarkTransform(place, expanded) {
    const viewport = dialog.getBoundingClientRect();
    let width, left, top;
    const ratio = place.width / place.height;
    if (expanded) {
      const scale = viewport.height * .75 / place.height;
      width = place.width * scale;
      // Anchor the visible ground, excluding each cutout's transparent padding.
      // Let wide skylines crop at the viewport rather than shrinking their height.
      left = viewport.width - place.groundRight * scale;
      top = viewport.height - place.groundBottom * scale;
    } else {
      const source = place.hotspot.getBoundingClientRect();
      // The source illustration crops these cutouts at the shoreline and sides.
      // Match their height rather than shrinking them into the hit area's box.
      width = Math.max(source.width, source.height * ratio);
      left = source.left - viewport.left + (source.width - width) / 2;
      top = source.bottom - viewport.top - width / ratio;
    }
    return `translate3d(${left}px, ${top}px, 0) scale(${width / place.width})`;
  }

  function selectPlace(id, { instant = false, focusStory = false } = {}) {
    if (dialog.dataset.scene !== 'day') return;
    const next = landmarks.find(place => place.id === id) || null;
    const previousId = activePlace;
    activePlace = next?.id || null;
    dialog.classList.toggle('has-place', Boolean(next));
    hotspots.inert = Boolean(next);
    hotspots.setAttribute('aria-hidden', String(Boolean(next)));
    picture.setAttribute('aria-hidden', String(Boolean(next)));
    moveLayer(picture, { opacity: next ? '0' : '1' }, instant);
    moveLayer(sky, { opacity: next ? '1' : '0' }, instant);
    for (const place of landmarks) {
      const selected = place === next;
      moveLayer(place.element, {
        transform: landmarkTransform(place, selected),
        opacity: selected ? '1' : '0'
      }, instant);
      place.element.style.zIndex = selected ? '2' : '1';
      place.story.hidden = !selected;
      if (selected) {
        place.story.scrollTop = 0;
        if (previousId !== activePlace || instant) {
          placeMotions.get(place.story)?.cancel();
          if (!instant) place.story.style.opacity = '0';
          moveLayer(place.story, { opacity: '1' }, instant);
        }
        moveLayer(stories, { opacity: '1', transform: 'translateY(0px)' }, instant);
      }
    }
    if (!next) moveLayer(stories, { opacity: '0', transform: 'translateY(12px)' }, instant);
    switcher.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.place === (activePlace || 'all')));
    });
    if (focusStory && next) next.story.querySelector('h2').focus({ preventScroll: true });
  }

  function resetPlaces() {
    placeMotions.forEach(animation => animation.cancel());
    placeMotions.clear();
    activePlace = null;
    dialog.classList.remove('has-place');
    picture.style.opacity = '1';
    picture.removeAttribute('aria-hidden');
    sky.style.opacity = '0';
    stories.style.opacity = '0';
    stories.style.transform = 'translateY(12px)';
    hotspots.inert = false;
    hotspots.removeAttribute('aria-hidden');
    landmarks.forEach(place => {
      place.story.hidden = true;
      place.element.style.opacity = '0';
      if (dialog.open) place.element.style.transform = landmarkTransform(place, false);
    });
    switcher.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.place === 'all')));
  }
  hotspots.addEventListener('click', event => {
    const button = event.target.closest('button[data-place]');
    if (button) selectPlace(button.dataset.place, { focusStory: true });
  });
  switcher.addEventListener('click', event => {
    const button = event.target.closest('button[data-place]');
    if (button) selectPlace(button.dataset.place);
  });
  switcher.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...switcher.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    selectPlace(buttons[next].dataset.place);
  });
  let originClip = 'inset(0 round 0px)';
  function cancelMotion() {
    motions.forEach(animation => { animation.onfinish = null; animation.cancel(); });
    motions = [];
  }
  function finish() {
    cancelMotion();
    dialog.style.clipPath = 'none';
    if (!targetOpen && dialog.open) dialog.close();
  }
  function transition(open, instant = false) {
    targetOpen = open;
    trigger?.setAttribute('aria-expanded', String(open));
    if (instant || reducedMotion.matches) { finish(); return; }
    // Reverse the same timelines at their current presentation frame.
    if (motions.length) {
      motions.forEach(animation => animation.updatePlaybackRate(open ? 1 : -1));
      return;
    }
    const duration = 260;
    const surface = dialog.animate([
      { clipPath: originClip },
      { clipPath: 'inset(0px 0px 0px 0px round 0px)' }
    ], { duration, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'both' });
    const reveal = art.animate([
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: .12 },
      { opacity: 1, offset: .75 },
      { opacity: 1, offset: 1 }
    ], { duration, fill: 'both' });
    motions = [surface, reveal];
    motions.forEach(animation => {
      animation.pause();
      animation.currentTime = open ? 0 : duration;
      animation.playbackRate = open ? 1 : -1;
      animation.play();
    });
    surface.onfinish = finish;
  }
  function openExplorer(button, instant) {
    trigger = button;
    savedScroll = [window.scrollX, window.scrollY];
    // Measure the actual pill (including its press state), before locking scroll.
    const bounds = button.getBoundingClientRect();
    const night = document.documentElement.dataset.theme === 'dark';
    dialog.dataset.scene = night ? 'night' : 'day';
    picture.src = night ? scenes.night : scenes.day;
    picture.alt = night ? 'A blue and purple galaxy inspired by Rick and Morty.' : 'Chennai temple and waterfront on the left, the Boston skyline in the center, and New Orleans on the right.';
    hotspots.hidden = night;
    switcher.hidden = night;
    caption.textContent = night ? 'A galaxy inspired by Rick and Morty.' : '';
    caption.hidden = !night;
    dialog.showModal();
    resetPlaces();
    const viewport = dialog.getBoundingClientRect();
    close.style.left = `${bounds.left - viewport.left}px`;
    close.style.width = `${bounds.width}px`;
    originClip = `inset(${bounds.top - viewport.top}px ${viewport.right - bounds.right}px ${viewport.bottom - bounds.bottom}px ${bounds.left - viewport.left}px round ${getComputedStyle(trigger).borderRadius})`;
    document.body.classList.add('exploring-background');
    close.focus({ preventScroll: true });
    transition(true, instant);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-explore-background]');
    if (!button || !desktop.matches) return;
    if (dialog.open) transition(!targetOpen, event.detail === 0);
    else openExplorer(button, event.detail === 0);
  });
  // The return dock stays at the trigger position, including during reversals.
  close.addEventListener('click', event => transition(!targetOpen, event.detail === 0));
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (activePlace && targetOpen) {
      selectPlace('all');
      switcher.querySelector('[data-place="all"]').focus({ preventScroll: true });
    } else transition(false);
  });
  dialog.addEventListener('close', () => {
    cancelMotion();
    resetPlaces();
    targetOpen = false;
    document.body.classList.remove('exploring-background');
    if (trigger?.isConnected) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus({ preventScroll: true });
      window.scrollTo({ left: savedScroll[0], top: savedScroll[1], behavior: 'instant' });
    }
  });
  function teardown() { if (dialog.open) transition(false, true); }
  window.addEventListener('popstate', teardown);
  document.addEventListener('site:routechange', teardown);
  window.addEventListener('resize', () => {
    if (!dialog.open) return;
    {
      // Recompute the return destination after a desktop viewport resize.
      const bounds = trigger.getBoundingClientRect();
      const viewport = dialog.getBoundingClientRect();
      if (bounds.width) {
        close.style.left = `${bounds.left - viewport.left}px`;
        close.style.width = `${bounds.width}px`;
        originClip = `inset(${bounds.top - viewport.top}px ${viewport.right - bounds.right}px ${viewport.bottom - bounds.bottom}px ${bounds.left - viewport.left}px round ${getComputedStyle(trigger).borderRadius})`;
      } else {
        close.style.left = 'calc(50% - 90px)';
        close.style.width = '180px';
        originClip = 'inset(0px calc(50% - 90px) calc(100% - 40px) round 0px 0px 22px 22px)';
      }
      selectPlace(activePlace || 'all', { instant: true });
      finish();
    }
  });
  reducedMotion.addEventListener('change', () => {
    if (dialog.open && reducedMotion.matches) {
      selectPlace(activePlace || 'all', { instant: true });
      finish();
    }
  });
})();
