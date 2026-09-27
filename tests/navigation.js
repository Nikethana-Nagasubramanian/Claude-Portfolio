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
    assert(photo.parentNode === doc.body && photo.querySelector('img').loading === 'eager', 'Portrait can be clipped or lazy loaded');
    report('PASS: portrait focus, Escape, hover, touch, outside dismissal, body placement and eager loading.');
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
    assert(dialog.matches(':modal'), 'Explorer did not isolate the portfolio in a native modal');
    assert(doc.activeElement.classList.contains('background-explorer__close'), 'Explorer did not receive focus');
    await until(() => dialog.querySelector('img').naturalWidth > 0);
    if (dialog.dataset.scene === 'day') {
      assert(dialog.querySelector('[data-city="Boston"]').textContent.includes('2022'), 'City date missing');
      const stickers = [...dialog.querySelectorAll('.background-explorer__sticker')];
      assert(stickers.length === 3 && stickers.every(img => img.width === 130 && img.height === 130), 'Sticker dimensions differ');
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
    assert(!dialog.open, 'Escape did not close immediately during entry');
    await wait(30);
    assert(!doc.body.classList.contains('exploring-background'), 'Explorer left scroll locked');
    report('PASS: pointer transition can reverse during entry; Escape cancels immediately without a stale animation or scroll lock.');
    report('ALL CHECKS PASSED');
  } catch (error) { report('FAIL: ' + error.message); }
};
