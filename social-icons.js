(() => {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/regular/style.css';
  document.head.append(stylesheet);

  const icons = {
    LinkedIn: 'linkedin-logo',
    Twitter: 'x-logo',
    GitHub: 'github-logo',
    Email: 'envelope',
    Medium: 'medium-logo'
  };

  document.querySelectorAll('.social-links a').forEach((link) => {
    const icon = icons[link.title];
    if (icon) link.innerHTML = `<i class="ph ph-${icon}" aria-hidden="true"></i>`;
  });
})();
