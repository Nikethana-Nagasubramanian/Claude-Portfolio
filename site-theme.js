(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try {
    preference = localStorage.getItem('portfolio-theme');
  } catch (_) {}
  function apply() { root.dataset.theme = preference || (system.matches ? 'dark' : 'light'); }
  apply();
  system.addEventListener('change', () => { if (!preference) { apply(); update(); } });
  let themeToggle;
  function update() {
    if (!themeToggle) return;
    themeToggle.dataset.theme = root.dataset.theme;
    themeToggle.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === root.dataset.theme));
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.nav-content');
    if (!nav) return;
    let controls = nav.querySelector('.site-controls');
    themeToggle = nav.querySelector('.theme-toggle');
    if (!themeToggle) {
      controls = document.createElement('div');
      controls.className = 'site-controls';
      themeToggle = document.createElement('div');
      themeToggle.className = 'theme-toggle';
      themeToggle.setAttribute('role', 'group');
      themeToggle.setAttribute('aria-label', 'Color theme');
      themeToggle.innerHTML = '<span class="theme-toggle__thumb" aria-hidden="true"></span><button class="theme-option" type="button" data-theme-choice="light" aria-label="Light mode"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg></button><button class="theme-option" type="button" data-theme-choice="dark" aria-label="Dark mode"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg></button>';
      controls.append(themeToggle);
      nav.append(controls);
    }
    const lightButton = themeToggle.querySelector('[data-theme-choice="light"]');
    const darkButton = themeToggle.querySelector('[data-theme-choice="dark"]');
    const setTheme = (next) => {
      preference = next;
      try { localStorage.setItem('portfolio-theme', preference); } catch (_) {}
      apply(); update();
    };
    lightButton.addEventListener('click', () => setTheme('light'));
    darkButton.addEventListener('click', () => setTheme('dark'));
    update();
  });
})();
