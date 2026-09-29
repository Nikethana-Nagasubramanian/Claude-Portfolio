(() => {
  const switcher = document.querySelector('.case-view-switcher');
  if (!switcher) return;
  const tabs = [...switcher.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const navGroups = [...document.querySelectorAll('[data-view-nav]')];
  const links = [...document.querySelectorAll('.case-nav a')];
  let activeIndex = 0;
  let activeSections = [];
  let scrollFrame = 0;

  function updateNavigation() {
    scrollFrame = 0;
    document.body.classList.toggle('scout-nav-visible', window.scrollY > 16);
    const threshold = Math.max(120, window.innerHeight * .25);
    const current = activeSections.filter(section => section.getBoundingClientRect().top <= threshold).at(-1) || activeSections[0];
    links.forEach(link => {
      const active = link.hash === '#' + current?.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  const observer = new IntersectionObserver(updateNavigation, { rootMargin: '-20% 0px -70% 0px' });
  function activate(index, { focus = false, updateURL = false } = {}) {
    const previousY = window.scrollY;
    observer.disconnect();
    activeIndex = index;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
      navGroups[i].hidden = i !== index;
    });
    activeSections = [...navGroups[index].querySelectorAll('a')].map(link => document.getElementById(link.hash.slice(1)));
    activeSections.forEach(section => observer.observe(section));
    if (updateURL) {
      const hash = index ? '#brand-design' : '#product-design';
      if (location.hash !== hash) history.pushState(null, '', hash);
    }
    if (focus) {
      tabs[index].focus({ preventScroll: true });
      // Only relocate readers when the previous scroll position exceeds the new view.
      if (previousY > document.documentElement.scrollHeight - innerHeight + 1) {
        switcher.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }
    updateNavigation();
  }

  function restoreFromURL() {
    const target = document.getElementById(location.hash.slice(1));
    const index = location.hash === '#brand-design' || (target && panels[1].contains(target)) ? 1 : 0;
    activate(index);
    // Reveal a hidden panel before following a deep section link.
    if (target && panels[index].contains(target)) {
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }
  }

  tabs.forEach((tab, index) => tab.addEventListener('click', () => activate(index, { focus: true, updateURL: true })));
  switcher.addEventListener('keydown', event => {
    const destinations = { ArrowLeft: (activeIndex + tabs.length - 1) % tabs.length, ArrowRight: (activeIndex + 1) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    activate(destinations[event.key], { focus: true, updateURL: true });
  });
  window.addEventListener('hashchange', restoreFromURL);
  window.addEventListener('popstate', restoreFromURL);
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateNavigation);
  }, { passive: true });
  window.addEventListener('resize', updateNavigation);
  switcher.hidden = false;
  restoreFromURL();

  document.querySelectorAll('[data-brand-carousel]').forEach(carousel => {
    const track = carousel.querySelector('[data-carousel-track]');
    const slides = [...track.children];
    const previous = carousel.querySelector('[data-carousel-prev]');
    const next = carousel.querySelector('[data-carousel-next]');
    const count = carousel.querySelector('[data-carousel-count]');
    function currentIndex() {
      const left = track.getBoundingClientRect().left;
      return slides.reduce((closest, slide, index) => {
        const distance = Math.abs(slide.getBoundingClientRect().left - left);
        return distance < closest.distance ? { index, distance } : closest;
      }, { index: 0, distance: Infinity }).index;
    }
    function update() {
      // A hidden tab has no measurable slides. Preserve its carousel state.
      if (!track.clientWidth) return;
      const index = currentIndex();
      count.textContent = String(index + 1);
      previous.disabled = index === 0;
      next.disabled = index === slides.length - 1;
      slides.forEach((slide, i) => {
        slide.querySelectorAll('a').forEach(link => { link.tabIndex = i === index ? 0 : -1; });
      });
    }
    function show(index, keyboard = false) {
      const slide = slides[Math.max(0, Math.min(index, slides.length - 1))];
      track.scrollBy({ left: slide.getBoundingClientRect().left - track.getBoundingClientRect().left, behavior: keyboard || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    previous.addEventListener('click', event => show(currentIndex() - 1, event.detail === 0));
    next.addEventListener('click', event => show(currentIndex() + 1, event.detail === 0));
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('keydown', event => {
      if (event.target !== track) return;
      const destinations = { ArrowLeft: currentIndex() - 1, ArrowRight: currentIndex() + 1, Home: 0, End: slides.length - 1 };
      if (!(event.key in destinations)) return;
      event.preventDefault();
      show(destinations[event.key], true);
    });
    new ResizeObserver(update).observe(track);
    update();
  });

  const dialog = document.querySelector('.brand-image-dialog');
  const preview = dialog.querySelector('img');
  const stage = dialog.querySelector('.brand-preview-stage');
  const zoom = dialog.querySelector('.brand-preview-zoom');
  const close = dialog.querySelector('.brand-preview-close');
  let previewTrigger;
  let previousOverflow;
  preview.addEventListener('load', () => {
    preview.style.setProperty('--preview-natural-width', preview.naturalWidth + 'px');
  });
  document.querySelectorAll('[data-brand-preview]').forEach(trigger => {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', event => {
      event.preventDefault();
      previewTrigger = trigger;
      preview.src = trigger.href;
      preview.alt = trigger.closest('figure')?.querySelector('img')?.alt || trigger.dataset.brandPreview;
      document.getElementById('brand-preview-title').textContent = trigger.dataset.brandPreview;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
      stage.scrollTop = stage.scrollLeft = 0;
      close.focus();
    });
  });
  zoom.addEventListener('click', () => {
    const zoomed = dialog.toggleAttribute('data-zoomed');
    zoom.setAttribute('aria-pressed', String(zoomed));
    zoom.textContent = zoomed ? 'Fit to screen' : 'Zoom in';
    stage.scrollTop = stage.scrollLeft = 0;
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    dialog.removeAttribute('data-zoomed');
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = 'Zoom in';
    previewTrigger?.focus({ preventScroll: true });
  });
})();
