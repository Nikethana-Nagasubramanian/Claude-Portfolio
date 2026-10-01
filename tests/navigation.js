/* Run through tests/navigation.html using any browser and the static server. */
const frame = document.querySelector('iframe');
const results = document.querySelector('#results');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(condition, message) { if (!condition) throw new Error(message); }
function report(message) { const item = document.createElement('li'); item.textContent = message; results.append(item); }
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await wait(50); }
  throw new Error('Timed out waiting for route');
}
document.querySelector('#run').onclick = async () => {
  results.replaceChildren();
  try {
    await until(() => frame.contentDocument.querySelector('.route-status'));
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    const shell = ['.site-rail', '.mobile-shell-header', '.site-controls', '.atmosphere', '.site-footer', 'main'].map(selector => doc.querySelector(selector));
    const styles = [...doc.querySelectorAll('link[rel=stylesheet]')].map(link => link.href).join();
    const geometry = () => { const el = doc.querySelector('main'); const r = el.getBoundingClientRect(); const css = win.getComputedStyle(el); return [r.x, r.width, css.paddingTop, css.paddingLeft].join(); };
    const baseline = geometry();
    async function go(name) {
      const link = [...doc.querySelectorAll('.site-rail__nav a')].find(link => link.textContent === name);
      link.click();
      assert(link.getAttribute('aria-current') === 'page', 'Active nav did not update synchronously');
      await until(() => win.location.pathname.endsWith(link.getAttribute('href')) && !doc.querySelector('main').hasAttribute('aria-busy'));
      await wait(80);
      assert(frame.contentDocument === doc, 'Document reloaded');
      assert(shell.every(node => node.isConnected), 'Persistent shell node was replaced');
      assert(geometry() === baseline, 'Frame geometry changed: ' + geometry());
      assert([...doc.querySelectorAll('link[rel=stylesheet]')].map(link => link.href).join() === styles, 'Stylesheets changed');
      assert(doc.activeElement.tagName === 'H1', 'New heading did not receive focus');
      assert(win.getComputedStyle(doc.querySelector('main')).visibility === 'visible', 'Main content hidden');
    }
    for (const name of ['About Nike','Playground','Archived Projects','Home','About Nike','Home']) await go(name);
    report('PASS: six route changes preserve document, shell, styles, frame, active state and heading focus.');
    const personal = doc.querySelector('[data-tab="personal"]');
    personal.click();
    win.scrollTo({top: 500, behavior: 'instant'}); await wait(100);
    const scroll = win.scrollY;
    await go('Archived Projects');
    doc.querySelector('[data-tab="interviews"]').click();
    win.history.back();
    await until(() => win.location.pathname.endsWith('index.html'));
    await wait(100);
    assert(doc.querySelector('[data-tab="personal"]').getAttribute('aria-selected') === 'true', 'Home tab was not restored');
    assert(Math.abs(win.scrollY - scroll) <= 1, 'Back did not restore scroll');
    win.history.forward(); await until(() => win.location.pathname.endsWith('archive.html')); await wait(100);
    assert(doc.querySelector('[data-tab="interviews"]').getAttribute('aria-selected') === 'true', 'Archive tab was not restored');
    report('PASS: Back/Forward restore route, tab selection and scroll.');
    for (const name of ['About Nike','Playground','Home']) [...doc.querySelectorAll('.site-rail__nav a')].find(link => link.textContent === name).click();
    await wait(100);
    assert(win.location.pathname.endsWith('index.html') && doc.title === 'Product Builder', 'Rapid clicks committed a stale route');
    assert(shell.every(node => node.isConnected), 'Rapid clicks replaced shell');
    report('PASS: rapid repeat navigation ends on the latest route.');
    const trigger = doc.querySelector('.nike-preview');
    const photo = doc.querySelector('#nike-portrait');
    trigger.focus();
    assert(trigger.getAttribute('aria-expanded') === 'true', 'Keyboard focus did not open portrait');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    assert(trigger.getAttribute('aria-expanded') === 'false', 'Escape did not dismiss portrait');
    trigger.blur();
    trigger.dispatchEvent(new win.PointerEvent('pointerenter', {pointerType:'mouse'}));
    if (win.matchMedia('(hover: hover) and (pointer: fine)').matches) assert(photo.classList.contains('is-visible'), 'Mouse hover did not open portrait');
    trigger.dispatchEvent(new win.PointerEvent('pointerleave', {pointerType:'mouse'}));
    assert(photo.getAttribute('aria-hidden') === 'true', 'Mouse exit did not dismiss portrait');
    trigger.dispatchEvent(new win.PointerEvent('pointerdown', {pointerType:'touch'})); trigger.click();
    assert(photo.classList.contains('is-visible'), 'Touch did not open portrait');
    doc.body.dispatchEvent(new win.PointerEvent('pointerdown', {bubbles:true}));
    assert(photo.getAttribute('aria-hidden') === 'true', 'Outside pointer did not dismiss portrait');
    assert(photo.parentNode === doc.querySelector('.site-rail') && photo.querySelector('img').loading === 'eager', 'Portrait is not anchored inside the rail or eager loaded');
    report('PASS: portrait focus, Escape, hover, touch, outside dismissal, rail placement and eager loading.');
    const link = doc.querySelector('.site-rail__nav a[href="about.html"]');
    const modified = new win.MouseEvent('click', {bubbles:true,cancelable:true,ctrlKey:true,button:0});
    // Prevent the browser opening a real test tab, after the router has run.
    let intercepted;
    const observe = event => { intercepted = event.defaultPrevented; event.preventDefault(); };
    doc.addEventListener('click', observe, {once:true}); link.dispatchEvent(modified);
    assert(!intercepted, 'Router intercepted modified click');
    report('PASS: modified click retains native behavior.');
    const explore = doc.querySelector('[data-explore-background]');
    const beforeScroll = win.scrollY;
    explore.click();
    const dialog = doc.querySelector('.background-explorer');
    assert(dialog.open, 'Background explorer did not open');
    assert(dialog.getAnimations().length === 0, 'Keyboard opening animated');
    assert(dialog.matches(':modal'), 'Explorer did not isolate the portfolio in a native modal');
    assert(doc.activeElement.classList.contains('background-explorer__close'), 'Explorer did not receive focus');
    await until(() => dialog.querySelector('img').naturalWidth > 0);
    if (dialog.dataset.scene === 'day') {
      const hotspots = dialog.querySelector('.background-explorer__hotspots');
      const cityNav = dialog.querySelector('.background-explorer__switcher');
      const stickers = [...dialog.querySelectorAll('.background-explorer__sticker')];
      assert(stickers.length === 3, 'City stickers missing');
      const dockLeft = dialog.querySelector('.background-explorer__close').getBoundingClientRect().left;
      hotspots.querySelector('[data-place="chennai"]').click();
      assert(!dialog.querySelector('#explorer-story-chennai').hidden, 'Chennai did not open');
      assert(dialog.querySelector('#explorer-story-chennai').textContent.includes('quiet reliability'), 'Chennai story missing');
      assert(hotspots.inert, 'Background hotspots remain interactive behind story');
      cityNav.querySelector('[data-place="boston"]').click();
      cityNav.querySelector('[data-place="nola"]').click();
      assert(dialog.querySelector('#explorer-story-chennai').hidden && dialog.querySelector('#explorer-story-boston').hidden, 'Stale city stories remain open');
      assert(!dialog.querySelector('#explorer-story-nola').hidden, 'Rapid switching lost latest city');
      assert(cityNav.querySelector('[data-place="nola"]').getAttribute('aria-pressed') === 'true', 'Switcher lost selected state');
      assert(dialog.querySelector('.background-explorer__close').getBoundingClientRect().left === dockLeft, 'City selection moved return dock');
      dialog.dispatchEvent(new win.Event('cancel', {cancelable:true}));
      assert(dialog.open && !dialog.classList.contains('has-place'), 'Escape failed to return to landscape');
      assert(!hotspots.inert, 'Returning to landscape left landmarks disabled');
    }
    dialog.querySelector('.background-explorer__close').click();
    await wait(80);
    assert(!dialog.open && doc.activeElement === explore, 'Explorer did not restore focus');
    assert(win.scrollY === beforeScroll, 'Explorer changed scroll position');
    assert(shell.every(node => node.isConnected), 'Explorer replaced the shell');
    report('PASS: explorer opens, loads the illustration, isolates content, and restores focus and scroll.');
    explore.dispatchEvent(new win.MouseEvent('click', {bubbles:true, detail:1}));
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      assert(dialog.getAnimations().length === 1, 'Pointer open did not animate');
    }
    dialog.querySelector('.background-explorer__close').dispatchEvent(new win.MouseEvent('click', {bubbles:true, detail:1}));
    await until(() => !dialog.open);
    await wait(30);
    assert(doc.activeElement === explore, 'Interrupted transition lost return focus');
    explore.dispatchEvent(new win.MouseEvent('click', {bubbles:true, detail:1}));
    dialog.dispatchEvent(new win.Event('cancel', {cancelable:true}));
    await until(() => !dialog.open);
    await wait(30);
    assert(!doc.body.classList.contains('exploring-background'), 'Explorer left scroll locked');
    report('PASS: pointer transition reverses during entry; Escape closes without stale animation or scroll lock.');
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      explore.dispatchEvent(new win.MouseEvent('click', {bubbles:true, detail:1}));
      const surface = dialog.getAnimations()[0];
      const origin = surface.effect.getKeyframes()[0].clipPath;
      assert(origin.includes('round') && origin !== 'inset(0px)', 'Expansion origin is not rounded');
      await wait(90);
      const close = dialog.querySelector('.background-explorer__close');
      close.dispatchEvent(new win.MouseEvent('click', {bubbles:true, detail:1}));
      assert(dialog.getAnimations()[0] === surface, 'Closing restarted the animation');
      await wait(30);
      close.dispatchEvent(new win.MouseEvent('click', {bubbles:true, detail:1}));
      assert(dialog.getAnimations()[0] === surface, 'Reopening replaced the active animation');
      await until(() => dialog.getAnimations().length === 0);
      assert(dialog.open, 'Repeat click failed to reverse closing');
      assert(win.getComputedStyle(dialog).clipPath === 'none', 'Expanded viewport remains clipped');
      close.click();
      await until(() => !dialog.open);
      report('PASS: repeated clicks reverse the same anchored animation in both directions.');
    }
    // Resize the real embedded viewport across the control breakpoint.
    frame.style.width = '390px'; await wait(80);
    assert(win.getComputedStyle(explore).display === 'none', 'Mobile explorer control visible');
    assert(win.getComputedStyle(doc.querySelector('main')).borderTopWidth === '0px', 'Mobile stage border visible');
    assert(doc.documentElement.scrollWidth <= win.innerWidth, 'Mobile page overflows horizontally');
    frame.style.width = '1280px'; await wait(80);
    report('PASS: mobile keeps the simplified scenery, hides the control, and has no horizontal overflow.');
    // Isolate the reduced-motion JS branch without changing OS preferences.
    const reducedFrame = document.createElement('iframe');
    reducedFrame.title = 'Reduced-motion explorer check';
    reducedFrame.srcdoc = `<body class="has-rail"><button data-explore-background>Explore</button>
      <script>const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => query === '(prefers-reduced-motion: reduce)'
        ? { matches: true, addEventListener() {} } : nativeMatchMedia(query);<\/script>
      <script src="/background-explorer.js"><\/script>`;
    document.body.append(reducedFrame);
    try {
      await until(() => reducedFrame.contentDocument.querySelector('dialog'));
      const reducedDoc = reducedFrame.contentDocument;
      const reducedWin = reducedFrame.contentWindow;
      reducedDoc.querySelector('button').dispatchEvent(new reducedWin.MouseEvent('click', {bubbles:true, detail:1}));
      const reducedDialog = reducedDoc.querySelector('dialog');
      assert(reducedDialog.open && reducedDialog.getAnimations({subtree:true}).length === 0, 'Reduced motion animated on pointer opening');
      reducedDialog.dispatchEvent(new reducedWin.Event('cancel', {cancelable:true}));
      assert(!reducedDialog.open, 'Reduced motion animated on Escape');
      report('PASS: reduced-motion signal bypasses expansion and dismissal animations.');
    } finally { reducedFrame.remove(); }
    report('ALL CHECKS PASSED');
  } catch (error) { report('FAIL: ' + error.message); }
};
