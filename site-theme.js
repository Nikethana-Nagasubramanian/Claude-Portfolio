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
  let themeToggles = [];
  function update() {
    themeToggles.forEach((toggle) => {
      toggle.dataset.theme = root.dataset.theme;
      toggle.querySelectorAll('[data-theme-choice]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.themeChoice === root.dataset.theme));
      });
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    // Pages may carry several toggles (mobile nav + rail); wire every one.
    themeToggles = Array.from(document.querySelectorAll('.theme-toggle'));
    const nav = document.querySelector('.nav-content');
    if (!themeToggles.length) {
      if (!nav) return;
      const controls = document.createElement('div');
      controls.className = 'site-controls';
      const themeToggle = document.createElement('div');
      themeToggle.className = 'theme-toggle';
      themeToggle.setAttribute('role', 'group');
      themeToggle.setAttribute('aria-label', 'Color theme');
      themeToggle.innerHTML = '<span class="theme-toggle__thumb" aria-hidden="true"></span><button class="theme-option" type="button" data-theme-choice="light" aria-label="Light mode"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg></button><button class="theme-option" type="button" data-theme-choice="dark" aria-label="Dark mode"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg></button>';
      controls.append(themeToggle);
      nav.append(controls);
      themeToggles = [themeToggle];
    }
    const setTheme = (next) => {
      preference = next;
      try { localStorage.setItem('portfolio-theme', preference); } catch (_) {}
      apply(); update();
    };
    themeToggles.forEach((toggle) => {
      toggle.querySelectorAll('[data-theme-choice]').forEach((button) => {
        button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
      });
    });
    update();
  });
})();
