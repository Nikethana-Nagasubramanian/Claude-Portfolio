(() => {
  document.querySelectorAll('.story-player').forEach(player => {
    const slides = window.portfolioStories?.[player.dataset.story];
    if (!slides) return;
    let index = 0;
    let start = null;
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    };
    const stage = make('div', 'story-stage');
    stage.id = `story-stage-${player.dataset.story}`;
    const panels = slides.map((slide, i) => {
      const panel = make('section', 'story-moment');
      panel.setAttribute('aria-label', `Moment ${i + 1} of ${slides.length}`);
      const copy = make('div', 'story-copy');
      if (slide.eyebrow) copy.append(make('p', 'story-eyebrow', slide.eyebrow));
      copy.append(make('h2', '', slide.title), make('p', '', slide.text));
      if (slide.stats.length) {
        const stats = make('div', 'story-stats');
        slide.stats.forEach(stat => {
          const p = make('p');
          p.append(make('strong', '', stat.value), make('span', '', stat.label));
          stats.append(p);
        });
        copy.append(stats);
      }
      if (slide.closing) copy.append(make('p', 'story-closing', slide.closing));
      const figure = slide.media ? make('figure', 'story-figure') : null;
      if (figure) {
      const media = make(slide.media.video ? 'video' : 'img');
      media.src = slide.media.src;
      if (slide.media.video) {
        media.controls = true;
        media.playsInline = true;
        media.preload = 'metadata';
        media.setAttribute('aria-label', slide.media.alt);
      } else { media.alt = slide.media.alt; }
      figure.append(media);
      panel.append(copy, figure);
      } else {
        panel.append(copy);
      }
      stage.append(panel);
      return panel;
    });
    const controls = make('div', 'story-controls');
    const hint = make('span', 'story-hint');
    hint.append(make('span', 'story-hint-label', 'Use'), make('kbd', '', '←'), make('kbd', '', '→'), make('span', 'story-hint-label', 'arrow keys'));
    const prev = make('button', '', '←');
    const next = make('button', '', '→');
    const progress = make('span', 'story-progress');
    progress.setAttribute('role', 'status');
    progress.setAttribute('aria-live', 'polite');
    [prev, next].forEach(button => { button.type = 'button'; button.setAttribute('aria-controls', stage.id); });
    prev.setAttribute('aria-label', 'Previous moment');
    next.setAttribute('aria-label', 'Next moment');
    controls.append(hint, prev, progress, next);
    player.append(stage, controls);
    function show(value) {
      index = Math.max(0, Math.min(slides.length - 1, value));
      panels.forEach((panel, i) => {
        panel.hidden = i !== index;
        if (panel.hidden) panel.querySelectorAll('video').forEach(video => video.pause());
      });
      // Keep boundary controls focusable so keyboard focus never falls out of the viewer.
      prev.setAttribute('aria-disabled', String(index === 0));
      next.setAttribute('aria-disabled', String(index === slides.length - 1));
      progress.textContent = `${index + 1} of ${slides.length}`;
    }
    prev.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    (player.closest('dialog') || player).addEventListener('keydown', event => {
      if (event.target.closest('video')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(index + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    stage.addEventListener('touchstart', event => {
      start = event.touches.length === 1 && !event.target.closest('video') ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
    }, {passive:true});
    stage.addEventListener('touchend', event => {
      if (!start) return;
      const dx = event.changedTouches[0].clientX - start.x;
      const dy = event.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
      start = null;
    }, {passive:true});
    stage.addEventListener('touchcancel', () => { start = null; });
    player.addEventListener('story-reset', () => show(0));
    document.addEventListener('keydown', event => {
      if (event.target.closest('input, textarea, select, video, [contenteditable="true"]')) return;
      const visible = !player.closest('[hidden]') && player.offsetParent !== null;
      if (!visible || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    show(0);
  });
})();
