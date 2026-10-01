(() => {
  'use strict';

  const board = document.querySelector('[data-believe-board]');
  const notesLayer = document.querySelector('[data-believe-notes]');
  const form = document.querySelector('[data-believe-form]');
  if (!board || !notesLayer || !form) return;

  const input = form.querySelector('[data-note-input]');
  const preview = form.querySelector('[data-note-preview]');
  const count = form.querySelector('[data-character-count]');
  const submit = form.querySelector('[data-stick-button]');
  const formStatus = form.querySelector('[data-form-status]');
  const composer = document.getElementById('note-composer');
  const openComposer = document.querySelector('[data-open-composer]');
  const closeComposer = document.querySelector('[data-close-composer]');
  const wallStatus = document.querySelector('[data-wall-status]');
  const styleSummary = document.querySelector('[data-style-summary]');
  const mobileComposer = matchMedia('(max-width: 720px)');
  const boardMessage = board.querySelector('[data-board-message]');
  const trashTarget = document.querySelector('[data-trash-target]');
  const trashLabel = trashTarget?.querySelector('[data-trash-label]');
  const storageKey = 'believe-wall-local-notes-v1';
  const tokenKey = 'believe-wall-owner-v1';
  const colors = new Set(['sunshine', 'blush', 'sky', 'mint', 'lilac']);
  const inks = new Set(['charcoal', 'navy', 'berry', 'forest', 'violet']);
  const fonts = new Set(['patrick', 'caveat']);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { notes: [], drag: null, saveTimer: null, trashTimer: null, deleting: new Set(), posting: false };
  let statusTimer;
  let composerAnimation;
  let composerClosing = false;
  let closeSequence = 0;

  function syncComposerViewport() {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const bottom = Math.max(0, window.innerHeight - height - (viewport?.offsetTop || 0));
    composer.style.setProperty('--composer-height', height + 'px');
    composer.style.setProperty('--composer-bottom', bottom + 'px');
  }

  function updateSubmit() {
    submit.disabled = state.posting || !input.value.trim();
    form.setAttribute('aria-busy', String(state.posting));
  }

  function animateComposer(opening) {
    composerAnimation?.cancel();
    if (reduceMotion.matches) return Promise.resolve();
    const offset = mobileComposer.matches ? 'translateY(24px)' : 'translateY(-8px) scale(.98)';
    const frames = [{ opacity: 0, transform: offset }, { opacity: 1, transform: 'none' }];
    composerAnimation = composer.animate(opening ? frames : frames.reverse(), {
      duration: opening ? 220 : 140,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
      fill: 'both',
    });
    return composerAnimation.finished.catch(() => {});
  }

  async function dismissComposer({ restoreFocus = true, immediate = false } = {}) {
    if (!composer.open || (composerClosing && !immediate)) return;
    const sequence = ++closeSequence;
    composerClosing = true;
    input.blur();
    if (!immediate) await animateComposer(false);
    if (sequence !== closeSequence) return;
    composer.close();
    composerAnimation?.cancel();
    composerClosing = false;
    if (restoreFocus) openComposer.focus({ preventScroll: true });
  }

  openComposer.addEventListener('click', () => {
    if (composer.open) return;
    syncComposerViewport();
    formStatus.textContent = '';
    updateSubmit();
    composer.showModal();
    animateComposer(true);
    // Mobile starts without forcing the keyboard over the paper choices.
    if (!mobileComposer.matches) input.focus({ preventScroll: true });
  });
  closeComposer.addEventListener('click', () => dismissComposer());
  composer.addEventListener('cancel', event => {
    event.preventDefault();
    dismissComposer();
  });
  let backdropPress = false;
  function outsideComposer(event) {
    const rect = composer.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
  }
  composer.addEventListener('pointerdown', event => { backdropPress = event.target === composer && outsideComposer(event); });
  composer.addEventListener('click', event => {
    if (backdropPress && event.target === composer && outsideComposer(event)) dismissComposer();
    backdropPress = false;
  });
  composer.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !submit.disabled) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  window.visualViewport?.addEventListener('resize', syncComposerViewport);
  window.visualViewport?.addEventListener('scroll', syncComposerViewport);
  window.addEventListener('resize', syncComposerViewport);

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }

  function randomId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function getOwnerToken() {
    const existing = storageGet(tokenKey);
    if (existing && existing.length >= 20) return existing;
    const created = `${randomId()}-${randomId()}`;
    storageSet(tokenKey, created);
    return created;
  }

  const ownerToken = getOwnerToken();

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function cleanNote(note) {
    if (!note || typeof note.content !== 'string' || !note.content.trim()) return null;
    return {
      id: String(note.id || `local-${randomId()}`),
      content: note.content.trim().slice(0, 160),
      noteColor: colors.has(note.noteColor) ? note.noteColor : 'sunshine',
      inkColor: inks.has(note.inkColor) ? note.inkColor : 'charcoal',
      font: fonts.has(note.font) ? note.font : 'patrick',
      x: clamp(note.x),
      y: clamp(note.y),
      rotation: clamp(note.rotation, -6, 6),
      owned: Boolean(note.owned),
      localOnly: Boolean(note.localOnly) || String(note.id || '').startsWith('local-'),
    };
  }

  function readLocalNotes() {
    try {
      const parsed = JSON.parse(storageGet(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed.map(cleanNote).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function saveLocalNotes() {
    const localNotes = state.notes.filter(note => note.localOnly);
    storageSet(storageKey, JSON.stringify(localNotes));
  }

  function setStatus(message, isError = false) {
    const target = composer.open ? formStatus : wallStatus;
    target.textContent = message;
    target.dataset.error = String(isError);
    clearTimeout(statusTimer);
    if (target === wallStatus) statusTimer = setTimeout(() => { wallStatus.textContent = ''; }, 6000);
  }

  async function request(method, body) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Believe-Owner': ownerToken },
    };
    if (body) options.body = JSON.stringify({ ...body, ownerToken });
    const response = await fetch('/api/believe-notes', options);
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(payload.error || 'The shared wall is unavailable.');
    return payload;
  }

  function positionElement(element, note) {
    const maxX = Math.max(0, board.clientWidth - element.offsetWidth);
    const maxY = Math.max(0, board.clientHeight - element.offsetHeight);
    const px = clamp(note.x) * maxX;
    const py = clamp(note.y) * maxY;
    element.dataset.px = String(px);
    element.dataset.py = String(py);
    element.style.setProperty('--note-x', `${px}px`);
    element.style.setProperty('--note-y', `${py}px`);
    element.style.setProperty('--note-rotation', `${note.rotation}deg`);
  }

  function noteElement(note, landing = false) {
    const element = document.createElement('div');
    element.className = `visitor-note${note.owned ? ' is-owned' : ''}${landing && !reduceMotion.matches ? ' is-landing' : ''}`;
    element.dataset.noteId = note.id;
    element.dataset.noteColor = note.noteColor;
    element.dataset.inkColor = note.inkColor;
    element.dataset.font = note.font;
    element.textContent = note.content;
    if (note.owned) {
      element.tabIndex = 0;
      element.setAttribute('role', 'group');
      element.setAttribute('aria-label', `Your note: ${note.content}. Drag it, use the arrow keys to move it, or press Delete to remove it.`);
    } else {
      element.setAttribute('aria-label', `Anonymous note: ${note.content}`);
    }
    notesLayer.append(element);
    positionElement(element, note);
    if (landing) element.addEventListener('animationend', () => element.classList.remove('is-landing'), { once: true });
    return element;
  }

  function renderNotes() {
    notesLayer.replaceChildren();
    state.notes.forEach(note => noteElement(note));
    boardMessage.hidden = true;
  }

  function redrawPositions() {
    for (const element of notesLayer.querySelectorAll('.visitor-note')) {
      const note = state.notes.find(item => item.id === element.dataset.noteId);
      if (note) positionElement(element, note);
    }
  }

  async function loadNotes() {
    const localNotes = readLocalNotes();
    try {
      const payload = await request('GET');
      const remoteNotes = Array.isArray(payload.notes) ? payload.notes.map(cleanNote).filter(Boolean) : [];
      const remoteIds = new Set(remoteNotes.map(note => note.id));
      state.notes = remoteNotes.concat(localNotes.filter(note => !remoteIds.has(note.id)));
      renderNotes();
      if (!state.notes.length) {
        boardMessage.textContent = 'The wall is waiting for its first note.';
        boardMessage.hidden = false;
      }
    } catch (_) {
      state.notes = localNotes;
      renderNotes();
      boardMessage.textContent = state.notes.length ? 'Showing notes saved on this browser.' : 'The shared wall is warming up—your note will still stay here.';
      boardMessage.hidden = false;
    }
  }

  function selected(name) {
    return form.elements[name].value;
  }

  function updatePreview() {
    preview.dataset.notePreview = selected('noteColor');
    preview.dataset.inkPreview = selected('inkColor');
    preview.dataset.fontPreview = selected('font');
    const paper = form.querySelector('input[name="noteColor"]:checked').nextElementSibling.textContent;
    const handwriting = form.querySelector('input[name="font"]:checked').nextElementSibling.textContent;
    styleSummary.textContent = paper + ' · ' + handwriting;
  }

  form.addEventListener('change', updatePreview);
  input.addEventListener('input', () => {
    count.textContent = String(input.value.length);
    updateSubmit();
  });

  function landingPosition() {
    const compact = board.clientWidth <= 720;
    return {
      x: clamp(.05 + Math.random() * (compact ? .62 : .52)),
      y: clamp((compact ? .43 : .55) + Math.random() * .31),
      rotation: Math.round((-4.5 + Math.random() * 9) * 10) / 10,
    };
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.posting) return;
    const content = input.value.trim();
    if (!content) {
      setStatus('Write something before sticking it up.', true);
      input.focus();
      return;
    }
    const position = landingPosition();
    const draft = {
      content,
      noteColor: selected('noteColor'),
      inkColor: selected('inkColor'),
      font: selected('font'),
      ...position,
    };
    state.posting = true;
    updateSubmit();
    setStatus('Finding a spot…');
    let note;
    let resultMessage;
    try {
      const payload = await request('POST', draft);
      note = cleanNote({ ...payload.note, owned: true });
      resultMessage = 'It’s on the wall. Drag it anywhere you like.';
    } catch (error) {
      note = cleanNote({ id: `local-${randomId()}`, ...draft, owned: true, localOnly: true });
      resultMessage = 'Saved on this browser while the shared wall is offline.';
    }
    if (note) {
      state.notes.push(note);
      await dismissComposer({ restoreFocus: false, immediate: true });
      noteElement(note, true).focus({ preventScroll: true });
      saveLocalNotes();
      boardMessage.hidden = true;
      input.value = '';
      count.textContent = '0';
      setStatus(resultMessage);
    }
    state.posting = false;
    updateSubmit();
  });

  function findNote(element) {
    return state.notes.find(note => note.id === element.dataset.noteId);
  }

  function moveToPointer(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = board.getBoundingClientRect();
    const maxX = Math.max(0, board.clientWidth - drag.element.offsetWidth);
    const maxY = Math.max(0, board.clientHeight - drag.element.offsetHeight);
    const px = clamp(event.clientX - rect.left - drag.grabX, 0, maxX);
    const py = clamp(event.clientY - rect.top - drag.grabY, 0, maxY);
    drag.note.x = maxX ? px / maxX : 0;
    drag.note.y = maxY ? py / maxY : 0;
    positionElement(drag.element, drag.note);
    updateTrashProximity(event);
  }

  function showTrash() {
    if (!trashTarget) return;
    trashTarget.classList.remove('is-consuming');
    trashTarget.classList.add('is-visible');
    if (trashLabel) trashLabel.textContent = 'Move here to remove';
  }

  function clearTrashTimer() {
    clearTimeout(state.trashTimer);
    state.trashTimer = null;
  }

  function hideTrash() {
    clearTrashTimer();
    if (!trashTarget) return;
    trashTarget.classList.remove('is-visible', 'is-armed', 'is-consuming');
    if (trashLabel) trashLabel.textContent = 'Move here to remove';
  }

  function updateTrashProximity(event) {
    if (!trashTarget || !state.drag) return;
    const rect = trashTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * .42;
    const near = Math.hypot(event.clientX - centerX, event.clientY - centerY) <= Math.max(78, rect.width * .72);
    state.drag.nearTrash = near;
    trashTarget.classList.toggle('is-armed', near);
    if (trashLabel) trashLabel.textContent = near ? 'Hold to crumple' : 'Move here to remove';
    if (near && !state.trashTimer) {
      const drag = state.drag;
      state.trashTimer = setTimeout(() => {
        state.trashTimer = null;
        if (state.drag === drag && drag.nearTrash) crumpleNote(drag.element, drag.note, drag.pointerId);
      }, 180);
    } else if (!near) {
      clearTrashTimer();
    }
  }

  async function persistPosition(note) {
    if (note.localOnly) {
      saveLocalNotes();
      setStatus('Position saved on this browser.');
      return;
    }
    try {
      await request('PATCH', { id: note.id, x: note.x, y: note.y });
      setStatus('Position saved.');
    } catch (_) {
      setStatus('That move could not be saved. Try once more.', true);
    }
  }

  async function deletePersistedNote(note) {
    if (note.localOnly) return true;
    try {
      await request('DELETE', { id: note.id });
      return true;
    } catch (_) {
      return false;
    }
  }

  function waitForCrumple(element) {
    return new Promise(resolve => {
      let complete = false;
      const finish = () => {
        if (complete) return;
        complete = true;
        resolve();
      };
      element.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, reduceMotion.matches ? 150 : 560);
    });
  }

  async function crumpleNote(element, note, pointerId = null) {
    if (!trashTarget || state.deleting.has(note.id)) return;
    state.deleting.add(note.id);
    clearTrashTimer();

    if (state.drag?.element === element) {
      try { element.releasePointerCapture(pointerId); } catch (_) {}
      state.drag = null;
    }

    const boardRect = board.getBoundingClientRect();
    const trashRect = trashTarget.getBoundingClientRect();
    const startX = Number(element.dataset.px) || 0;
    const startY = Number(element.dataset.py) || 0;
    const endX = trashRect.left - boardRect.left + trashRect.width / 2 - element.offsetWidth / 2;
    const endY = trashRect.top - boardRect.top + trashRect.height * .4 - element.offsetHeight / 2;
    const mix = amount => ({ x: startX + (endX - startX) * amount, y: startY + (endY - startY) * amount });
    const first = mix(.28);
    const second = mix(.68);
    element.style.setProperty('--crumple-x1', `${first.x}px`);
    element.style.setProperty('--crumple-y1', `${first.y}px`);
    element.style.setProperty('--crumple-x2', `${second.x}px`);
    element.style.setProperty('--crumple-y2', `${second.y}px`);
    element.style.setProperty('--crumple-x3', `${endX}px`);
    element.style.setProperty('--crumple-y3', `${endY}px`);
    element.classList.remove('is-dragging', 'is-settling');
    element.classList.add('is-crumpling');
    trashTarget.classList.add('is-visible', 'is-armed', 'is-consuming');
    if (trashLabel) trashLabel.textContent = 'Crumpling…';
    setStatus('Crumpling your note…');

    const deletion = deletePersistedNote(note);
    await waitForCrumple(element);
    element.remove();
    state.notes = state.notes.filter(item => item.id !== note.id);
    saveLocalNotes();
    const deleted = await deletion;

    if (deleted) {
      setStatus('Note removed.');
    } else {
      state.notes.push(note);
      noteElement(note, true).focus({ preventScroll: true });
      setStatus('That note could not be removed, so I put it back.', true);
    }

    state.deleting.delete(note.id);
    setTimeout(hideTrash, 150);
  }

  function finishDrag(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    moveToPointer(event);
    drag.element.classList.add('is-settling');
    drag.element.classList.remove('is-dragging');
    setTimeout(() => drag.element.classList.remove('is-settling'), 190);
    try { drag.element.releasePointerCapture(event.pointerId); } catch (_) {}
    state.drag = null;
    hideTrash();
    persistPosition(drag.note);
  }

  notesLayer.addEventListener('pointerdown', event => {
    const element = event.target.closest('.visitor-note.is-owned');
    if (!element || event.button !== 0) return;
    const note = findNote(element);
    if (!note) return;
    event.preventDefault();
    const boardRect = board.getBoundingClientRect();
    const px = Number(element.dataset.px) || 0;
    const py = Number(element.dataset.py) || 0;
    state.drag = {
      element,
      note,
      pointerId: event.pointerId,
      grabX: event.clientX - boardRect.left - px,
      grabY: event.clientY - boardRect.top - py,
    };
    element.setPointerCapture(event.pointerId);
    element.classList.add('is-dragging');
    element.focus({ preventScroll: true });
    showTrash();
  });

  notesLayer.addEventListener('pointermove', event => {
    if (!state.drag) return;
    event.preventDefault();
    moveToPointer(event);
  });
  notesLayer.addEventListener('pointerup', finishDrag);
  notesLayer.addEventListener('pointercancel', finishDrag);

  notesLayer.addEventListener('keydown', event => {
    const element = event.target.closest('.visitor-note.is-owned');
    if (!element) return;
    const note = findNote(element);
    if (!note) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      showTrash();
      trashTarget?.classList.add('is-armed');
      if (trashLabel) trashLabel.textContent = 'Crumpling…';
      requestAnimationFrame(() => crumpleNote(element, note));
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? .06 : .018;
    if (event.key === 'ArrowLeft') note.x = clamp(note.x - step);
    if (event.key === 'ArrowRight') note.x = clamp(note.x + step);
    if (event.key === 'ArrowUp') note.y = clamp(note.y - step);
    if (event.key === 'ArrowDown') note.y = clamp(note.y + step);
    positionElement(element, note);
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => persistPosition(note), 220);
  });

  if ('ResizeObserver' in window) new ResizeObserver(redrawPositions).observe(board);
  else addEventListener('resize', redrawPositions);

  updatePreview();
  updateSubmit();
  syncComposerViewport();
  loadNotes();
})();
