const statusEl = document.querySelector('#status');
const answerEl = document.querySelector('#answer');
const tabsEl = document.querySelector('#tabs');
const replay = document.querySelector('#replay');
let timers = [];
const tabData = { amazon: ['a', 'Amazon.com Utopia kitchen', 'amazon'], target: ['◉', 'GreenPan Rio Advanced 2pc (10" and 12") Ceramic Nonstick Fry Pan Set Cream', 'target'] };
function addTab(key, active = false) { const [icon, title, type] = tabData[key]; const tab = document.createElement('div'); tab.className = `tab${active ? ' active' : ''}`; tab.dataset.key = key; tab.innerHTML = `<span class="favicon ${type}">${icon}</span><span class="tab-title">${title}</span>`; tabsEl.append(tab); requestAnimationFrame(() => tab.classList.add('visible')); return tab; }
function setActive(key) { document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.key === key)); }
function later(ms, fn) { timers.push(setTimeout(fn,ms)); }
function start() {
  timers.forEach(clearTimeout); timers=[]; tabsEl.innerHTML=''; answerEl.hidden=true; statusEl.innerHTML='Thinking<span class="dots"><b>.</b><b>.</b><b>.</b></span>';
  later(1200, () => addTab('amazon', true)); later(2000, () => addTab('target')); later(3000, () => setActive('amazon')); later(3800, () => setActive('target')); later(5200, () => { const tab = document.querySelector('[data-key="target"]'); if (tab) tab.querySelector('.tab-title').textContent = 'GreenPan Rio Advanced 2pc...'; });
  later(7000,()=>{ statusEl.textContent='Comparing 3 options...'; });
  later(9000,()=>{ statusEl.innerHTML='<span class="done-check">✓</span> Done'; answerEl.hidden=false; });
}
replay.addEventListener('click',start); start();
