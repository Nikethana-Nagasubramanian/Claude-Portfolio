(() => {
  const dialog = document.querySelector('.walkthrough');
  const opener = document.querySelector('.walkthrough-open');
  if (!dialog || !opener || typeof dialog.showModal !== 'function') return;
  opener.hidden = false;
  opener.addEventListener('click', () => {
    dialog.querySelector('.story-player').dispatchEvent(new Event('story-reset'));
    dialog.showModal();
    dialog.querySelector('.walkthrough-close').focus();
  });
  dialog.querySelector('.walkthrough-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.querySelectorAll('video').forEach(video => video.pause());
    opener.focus({preventScroll:true});
  });
})();
