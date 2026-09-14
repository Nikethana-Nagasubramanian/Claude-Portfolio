(() => {
  const detailsToggle = document.querySelector('.details-toggle');
  const paddingOverlay = document.querySelector('.padding-overlay');
  let spacingRegions = [];
  const spacingValue = document.createElement('span');
  spacingValue.className = 'spacing-value';
  spacingValue.hidden = true;
  document.body.append(spacingValue);
  function inspectSpacing(event) {
    if (paddingOverlay.hidden) return;
    const region = spacingRegions.filter(r => event.pageX >= r.x && event.pageX <= r.x + r.width && event.pageY >= r.y && event.pageY <= r.y + r.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
    spacingValue.hidden = !region;
    if (!region) return;
    spacingValue.textContent = `${region.label} ${Math.round(region.value)}px`;
    spacingValue.style.left = `${Math.max(8, Math.min(event.clientX + 12, innerWidth - spacingValue.offsetWidth - 8))}px`;
    spacingValue.style.top = `${Math.max(8, Math.min(event.clientY + 16, innerHeight - spacingValue.offsetHeight - 8))}px`;
  }
  document.addEventListener('pointermove', inspectSpacing, { passive: true });
  document.addEventListener('pointerdown', inspectSpacing, { passive: true });
  addEventListener('scroll', () => { spacingValue.hidden = true; }, { passive: true });
  document.addEventListener('pointerleave', () => { spacingValue.hidden = true; });
  detailsToggle.hidden = false;
  function drawPadding() {
    paddingOverlay.replaceChildren();
    spacingRegions = [];
    spacingValue.hidden = true;
    if (paddingOverlay.hidden) return;
    const paths = { violet: [], grey: [] };
    document.querySelectorAll('.letter, .divided, .invitation, .project-preview, .portraits').forEach(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const top = parseFloat(style.paddingTop), right = parseFloat(style.paddingRight);
      const bottom = parseFloat(style.paddingBottom), left = parseFloat(style.paddingLeft);
      const borderTop = parseFloat(style.borderTopWidth), borderLeft = parseFloat(style.borderLeftWidth);
      const innerWidth = rect.width - borderLeft - parseFloat(style.borderRightWidth);
      const innerHeight = rect.height - borderTop - parseFloat(style.borderBottomWidth);
      [[borderLeft, borderTop, innerWidth, top], [borderLeft, borderTop + innerHeight - bottom, innerWidth, bottom],
        [borderLeft, borderTop + top, left, innerHeight - top - bottom], [borderLeft + innerWidth - right, borderTop + top, right, innerHeight - top - bottom]].forEach(([x, y, width, height], side) => {
        if (width <= 0 || height <= 0) return;
        const px = rect.left + scrollX + x, py = rect.top + scrollY + y;
        paths[element.matches('.invitation') ? 'grey' : 'violet'].push(`M${px} ${py}h${width}v${height}h${-width}Z`);
        spacingRegions.push({ x: px, y: py, width, height, value: side < 2 ? height : width, label: 'Padding' });
      });
    });
    document.querySelectorAll('.letter, .prose, .projects, .contributions').forEach(parent => {
      const children = [...parent.children];
      children.slice(1).forEach((child, index) => {
        const before = children[index].getBoundingClientRect();
        const after = child.getBoundingClientRect();
        const height = after.top - before.bottom;
        const x = Math.max(before.left, after.left) + scrollX;
        const width = Math.min(before.right, after.right) + scrollX - x;
        if (height <= 1 || width <= 0) return;
        const y = before.bottom + scrollY;
        paths.violet.push(`M${x} ${y}h${width}v${height}h${-width}Z`);
        spacingRegions.push({x, y, width, height, value: height, label: 'Gap'});
      });
    });
    // One compound path per color paints intersecting regions only once.
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', document.documentElement.clientWidth);
    svg.setAttribute('height', document.documentElement.scrollHeight);
    svg.innerHTML = '<defs><pattern id="detail-violet" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1 1-1M0 6 6 0M5 7 7 5" stroke="#9856d4" stroke-opacity=".22" stroke-width="1"/></pattern><pattern id="detail-grey" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1 1-1M0 6 6 0M5 7 7 5" stroke="#dedee3" stroke-opacity=".3" stroke-width="1"/></pattern></defs>';
    Object.entries(paths).forEach(([color, parts]) => {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', parts.join(' '));
      path.setAttribute('fill', `url(#detail-${color})`);
      svg.append(path);
    });
    paddingOverlay.append(svg);
    const experience = document.querySelector('#experience').getBoundingClientRect();
    const note = document.createElement('span');
    note.className = 'detail-note';
    note.textContent = 'Kinda digging the violet for gap indicators';
    Object.assign(note.style, { left: `${experience.left + scrollX}px`, top: `${experience.top + scrollY + 5}px`, width: `${experience.width}px` });
    paddingOverlay.append(note);
    ['#experience-title', '#imagining-type'].forEach(selector => {
      const target = document.querySelector(selector);
      const range = document.createRange();
      range.selectNodeContents(target);
      const rects = range.getClientRects();
      const rect = rects[rects.length - 1];
      if (!rect) return;
      const style = getComputedStyle(target);
      const label = document.createElement('span');
      label.className = 'type-detail';
      label.innerHTML = '<svg viewBox="0 0 12 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M2 1h2c1 0 2 1 2 2v10c0 1-1 2-2 2H2M10 1H8C7 1 6 2 6 3m0 10c0 1 1 2 2 2h2M3 8h6"/></svg>';
      label.append(`${style.fontSize} / ${style.fontWeight}`);
      paddingOverlay.append(label);
      const width = label.offsetWidth;
      const fits = rect.right + width + 12 < document.documentElement.clientWidth;
      Object.assign(label.style, {left: `${Math.max(8, Math.min(rect.right + 8, document.documentElement.clientWidth - width - 8)) + scrollX}px`, top: `${scrollY + (fits ? rect.top : rect.bottom + 2)}px`});
    });
  }
  detailsToggle.addEventListener('click', () => {
    paddingOverlay.hidden = !paddingOverlay.hidden;
    detailsToggle.setAttribute('aria-checked', String(!paddingOverlay.hidden));
    drawPadding();
  });
  new ResizeObserver(drawPadding).observe(document.querySelector('.letter'));
  addEventListener('resize', drawPadding);
  const nikePreview = document.querySelector('.nike-preview');
  const nikeButton = nikePreview.querySelector('button');
  const nikePhoto = nikePreview.querySelector('.nike-photo');
  function showNike(show) { nikePhoto.hidden = !show; nikeButton.setAttribute('aria-expanded', String(show)); }
  nikePreview.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') showNike(true); });
  nikePreview.addEventListener('pointerleave', () => { if (document.activeElement !== nikeButton) showNike(false); });
  nikeButton.addEventListener('focus', () => showNike(true));
  nikePreview.addEventListener('focusout', () => showNike(false));
  nikeButton.addEventListener('click', () => showNike(true));
  document.addEventListener('pointerdown', event => { if (!nikePreview.contains(event.target)) showNike(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') showNike(false); });
  const hero = document.querySelector('.hero');
  const headerButton = hero.querySelector('.change-header');
  const headerImages = [...hero.querySelectorAll('.hero-art, .header-variant')];
  const headerNames = ['Drafting paper', 'Aurora', 'Sky'];
  let headerIndex = 0;
  headerButton.hidden = false;
  headerButton.addEventListener('click', async () => {
    const next = (headerIndex + 1) % headerImages.length;
    headerButton.disabled = true;
    try {
      await headerImages[next].decode();
      headerIndex = next;
      hero.dataset.currentHeader = String(next);
      headerImages.forEach((image, index) => image.classList.toggle('is-active', index === next));
      headerButton.querySelector('.header-count').textContent = `${next + 1} / ${headerImages.length}`;
      hero.querySelector('.header-status').textContent = `${headerNames[next]} header, ${next + 1} of ${headerImages.length}`;
    } catch {
      hero.querySelector('.header-status').textContent = 'This header could not load. Please try again.';
    } finally {
      headerButton.disabled = false;
    }
  });
  const links = [...document.querySelectorAll('.section-nav a')];
  const sections = links.map(link => document.querySelector(link.hash));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Preserve native anchor/keyboard behavior; smooth only pointer navigation.
  links.forEach((link, index) => {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.detail === 0 || reducedMotion.matches) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      const section = sections[index];
      section.setAttribute('tabindex', '-1');
      section.focus({ preventScroll: true });
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.addEventListener('blur', () => section.removeAttribute('tabindex'), { once: true });
    });
  });
  let scheduled = false;
  function updateActive() {
    scheduled = false;
    let active = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= innerHeight * .36) active = index;
    });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 8) active = sections.length - 1;
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateActive); }
  }, { passive: true });
  addEventListener('resize', updateActive);
  updateActive();

  const preview = document.querySelector('.hover-preview');
  const dialog = document.querySelector('.image-dialog');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1021px)');
  let timer;
  function hidePreview() { clearTimeout(timer); preview.hidden = true; }
  function showPreview(button, row) {
    if (!finePointer.matches || dialog.open) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const rect = row.getBoundingClientRect();
      preview.querySelector('img').src = button.dataset.image;
      preview.querySelector('span').textContent = button.dataset.title;
      preview.hidden = false;
      const height = preview.getBoundingClientRect().height;
      preview.style.left = `${Math.min(innerWidth - 456, Math.max(16, rect.right - 440))}px`;
      preview.style.top = `${Math.max(16, rect.top - height - 12)}px`;
    }, 160);
  }
  document.querySelectorAll('.project').forEach(row => {
    const button = row.querySelector('.project-preview');
    row.addEventListener('pointerenter', () => showPreview(button, row));
    row.addEventListener('pointerleave', hidePreview);
    button.addEventListener('click', () => {
      hidePreview();
      dialog.querySelector('h2').textContent = button.dataset.title;
      const img = dialog.querySelector('.dialog-image');
      img.src = button.dataset.image;
      img.alt = button.querySelector('img').alt;
      dialog.showModal();
    });
  });
  dialog.querySelector('.close-preview').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  addEventListener('scroll', hidePreview, { passive: true });
  addEventListener('resize', hidePreview);
  addEventListener('keydown', event => { if (event.key === 'Escape') hidePreview(); });
})();
