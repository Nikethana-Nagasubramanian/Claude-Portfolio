/* Four static documents remain the source of truth. No script replay, framework,
   or server rewrite is required. All other links retain native navigation. */
(() => {
  const main = document.querySelector('main.route-frame');
  if (!main || !window.fetch || !window.DOMParser) return;
  const routes = new Set(['index', 'about', 'playground', 'archive']);
  const routeClasses = ['home-page', 'case-type', 'gf-case', 'about-case', 'playground-case', 'archive-page', 'has-atmosphere'];
  const cache = new Map();
  const pending = new Map();
  const positions = new Map();
  let sequence = 0;
  let restoring = false;
  let cleanup = () => {};
  let displayed = new URL(location.href);
  const status = document.createElement('div');
  status.className = 'route-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  document.body.append(status);

  function route(url) {
    if (url.origin !== location.origin) return null;
    const name = url.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '') || 'index';
    return name === 'about-nike' ? 'about' : routes.has(name) ? name : null;
  }
  function snapshot(doc) {
    const content = doc.querySelector('main.route-frame');
    if (!content) throw new Error('Not a shell document');
    return { content: content.cloneNode(true), title: doc.title,
      description: doc.querySelector('meta[name="description"]')?.content || '',
      classes: routeClasses.filter(name => doc.body.classList.contains(name)) };
  }
  function load(key) {
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const request = fetch('/' + key + '.html', { signal: controller.signal, credentials: 'same-origin', cache: 'no-cache' })
      .then(response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Unable to load route');
        return response.text();
      }).then(html => {
        const page = snapshot(new DOMParser().parseFromString(html, 'text/html'));
        cache.set(key, page);
        return page;
      }).finally(() => { clearTimeout(timeout); pending.delete(key); });
    pending.set(key, request);
    return request;
  }
  function active(url, animate = false) {
    const key = route(url);
    document.querySelectorAll('.site-rail__nav a').forEach(link => {
      if (route(new URL(link.href)) === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.dispatchEvent(new CustomEvent('site:navigation', { detail: { animate } }));
  }
  function record() {
    if (restoring || location.href !== displayed.href) return;
    positions.set(history.state?.portfolioKey, { scroll: [scrollX, scrollY],
      tab: main.querySelector('.work-tab[aria-selected="true"]')?.dataset.tab });
  }
  function save() {
    if (restoring || location.href !== displayed.href) return;
    record();
    history.replaceState({ ...history.state, ...positions.get(history.state?.portfolioKey) }, '', location.href);
  }
  function initialize(savedTab) {
    const tabs = [...main.querySelectorAll('.work-tab[data-tab]')];
    function select(tab) {
      tabs.forEach(item => {
        const selected = item === tab;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        const panel = main.querySelector('#panel-' + item.dataset.tab);
        if (panel) panel.hidden = !selected;
      });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => { select(tab); record(); });
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
          (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(tabs[next]); tabs[next].focus(); record();
      });
    });
    if (tabs.length) select(tabs.find(tab => tab.dataset.tab === savedTab) || tabs.find(tab => tab.classList.contains('active')) || tabs[0]);
    cleanup = () => {};
  }
  function position(url, state, isPop) {
    if (isPop && state?.scroll) window.scrollTo({ left: state.scroll[0], top: state.scroll[1], behavior: 'instant' });
    else if (url.hash) {
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch (_) { id = url.hash.slice(1); }
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    } else window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function commit(page, url, isPop, state, ticket) {
    if (ticket !== sequence) return;
    cleanup();
    // One synchronous DOM commit: no outgoing fade, empty frame, or shell rebuild.
    main.replaceChildren(...page.content.cloneNode(true).childNodes);
    main.className = page.content.className;
    routeClasses.forEach(name => document.body.classList.toggle(name, page.classes.includes(name)));
    document.title = page.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = page.description;
    if (!isPop) history.pushState({ portfolioKey: crypto.randomUUID(), scroll: [0, 0] }, '', url);
    displayed = url;
    initialize(isPop ? state?.tab : null);
    main.removeAttribute('aria-busy');
    document.dispatchEvent(new CustomEvent('site:routechange'));
    const heading = main.querySelector('h1') || main;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    position(url, state, isPop);
    // Also restore after layout, while guarding against a newer navigation.
    requestAnimationFrame(() => {
      if (ticket !== sequence) return;
      position(url, state, isPop);
      restoring = false;
      save();
    });
    status.textContent = page.title;
  }
  function navigate(url, { isPop = false, state = null, animate = false } = {}) {
    const key = route(url);
    if (!key) { location.assign(url.href); return; }
    if (!isPop) save();
    const ticket = ++sequence;
    restoring = true;
    active(url, animate);
    if (!isPop && url.href === displayed.href) {
      main.removeAttribute('aria-busy');
      document.dispatchEvent(new CustomEvent('site:routechange'));
      restoring = false;
      return;
    }
    if (cache.has(key)) { commit(cache.get(key), url, isPop, state, ticket); return; }
    main.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading ' + (document.querySelector('.site-rail__nav [aria-current]')?.textContent || 'page');
    load(key).then(page => commit(page, url, isPop, state, ticket)).catch(() => {
      if (ticket !== sequence) return;
      // Keep the old content visible until the browser's native fallback takes over.
      active(displayed);
      main.removeAttribute('aria-busy');
      restoring = false;
      if (isPop) location.replace(url.href);
      else location.assign(url.href);
    });
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download') || link.relList.contains('external')) return;
    const url = new URL(link.href);
    if (!route(url)) return;
    // Preserve native in-page anchors, selection, and hash history.
    if (url.pathname === displayed.pathname && url.search === displayed.search && url.hash && !restoring) return;
    event.preventDefault();
    navigate(url, { animate: event.detail !== 0 });
  });
  window.addEventListener('popstate', event => navigate(new URL(location.href), { isPop: true, state: positions.get(event.state?.portfolioKey) || event.state }));
  window.addEventListener('hashchange', () => { displayed = new URL(location.href); save(); });
  window.addEventListener('scroll', record, { passive: true });
  window.addEventListener('pagehide', save);
  window.addEventListener('pageshow', () => { restoring = false; active(new URL(location.href)); });
  history.scrollRestoration = 'manual';
  history.replaceState({ ...history.state, portfolioKey: history.state?.portfolioKey || crypto.randomUUID() }, '', location.href);
  cache.set(route(displayed), snapshot(document));
  initialize();
  active(displayed);
  save();
  for (const link of document.querySelectorAll('.site-rail__nav a')) {
    const prefetch = () => load(route(new URL(link.href))).catch(() => {});
    link.addEventListener('pointerenter', prefetch, { once: true });
    link.addEventListener('focus', prefetch, { once: true });
  }
  const prefetchAll = () => routes.forEach(key => { if (!cache.has(key)) load(key).catch(() => {}); });
  if ('requestIdleCallback' in window) requestIdleCallback(prefetchAll, { timeout: 1500 });
  else setTimeout(prefetchAll, 200);
})();
