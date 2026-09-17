/* Progressive enhancement: the complete article is the no-script fallback. */
(() => {
  const control = document.querySelector('.reading-control');
  const summary = document.querySelector('#case-summary');
  const detail = document.querySelector('#case-detail');
  if (!control || !summary || !detail) return;

  const sections = [...document.querySelectorAll('.case-section')];
  const buttons = [...control.querySelectorAll('button')];
  control.querySelector('[data-reading="full"]').setAttribute(
    'aria-controls', ['case-detail', ...sections.map(section => section.id)].join(' ')
  );
  const hasSectionHash = () => {
    const hash = location.hash.slice(1);
    return hash && hash !== 'overview' && document.getElementById(hash);
  };
  const fromURL = () => hasSectionHash() ||
    new URL(location.href).searchParams.get('read') === 'full' ? 'full' : 'short';

  function show(mode) {
    const full = mode === 'full';
    summary.hidden = full;
    detail.hidden = !full;
    sections.forEach(section => { section.hidden = !full; });
    document.body.dataset.reading = mode;
    control.dataset.mode = mode;
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.reading === mode));
    });
    if (!full) {
      document.querySelectorAll('video').forEach(video => video.pause());
    }
  }

  control.addEventListener('click', event => {
    const button = event.target.closest('button[data-reading]');
    if (!button) return;
    control.toggleAttribute('data-keyboard', event.detail === 0);
    const mode = button.dataset.reading;
    show(mode);
    const url = new URL(location.href);
    url.searchParams.set('read', full ? 'full' : 'short');
    url.hash = '';
    history.replaceState(null, '', url);
  });
  window.addEventListener('hashchange', () => show(fromURL()));
  window.addEventListener('popstate', () => show(fromURL()));
  show(fromURL());
  control.hidden = false;
})();
