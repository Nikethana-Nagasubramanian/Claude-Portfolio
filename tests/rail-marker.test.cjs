const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('rail-ui.js', 'utf8');
function setup(reduce = false) {
  const values = new Set(), events = {};
  const marker = { style: {}, dataset: {} };
  let current = { offsetTop: 0, offsetHeight: 24 };
  const nav = {
    classList: { add: x => values.add(x), toggle: (x, yes) => yes ? values.add(x) : values.delete(x) },
    querySelector: selector => selector === '.nav-marker' ? marker : current
  };
  const listen = (name, callback) => events[name] = callback;
  const code = source.slice(source.indexOf('  function navMarker()'), source.indexOf('  function portrait()'));
  vm.runInNewContext(code + '\nnavMarker();', {
    document: { querySelector: () => nav, addEventListener: listen },
    window: { addEventListener: listen }, reduced: {matches: reduce, addEventListener: listen}
  });
  return {marker, values, events, setCurrent: top => current = {offsetTop:top,offsetHeight:24}};
}
test('marker is positioned synchronously without a reveal gate', () => {
  const s = setup();
  assert.equal(s.marker.style.transform, 'translateY(8px)');
  assert.equal(s.marker.dataset.ready, 'true');
  assert(!s.values.has('marker-animated'));
});
test('route feedback retargets immediately and resize settles without animation', () => {
  const s = setup(); s.setCurrent(34); s.events['site:navigation']({detail:{animate:true}});
  assert.equal(s.marker.style.transform, 'translateY(42px)');
  assert(s.values.has('marker-animated'));
  s.setCurrent(102); s.events['site:navigation']({detail:{animate:true}});
  assert.equal(s.marker.style.transform, 'translateY(110px)');
  s.events.resize(); assert(!s.values.has('marker-animated'));
});
test('keyboard navigation and reduced motion update position without travel', () => {
  for (const reduced of [true, false]) {
    const s = setup(reduced); s.setCurrent(68);
    s.events['site:navigation']({detail:{animate:reduced}});
    assert.equal(s.marker.style.transform, 'translateY(76px)');
    assert(!s.values.has('marker-animated'));
  }
});
