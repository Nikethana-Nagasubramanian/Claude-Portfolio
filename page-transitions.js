/* Keep keyboard navigation immediate and never capture an unfinished rail. */
(function () {
  var keyboard = false;
  document.addEventListener('keydown', function () { keyboard = true; });
  document.addEventListener('pointerdown', function () { keyboard = false; });
  window.addEventListener('pageswap', function (event) {
    if (event.viewTransition && (keyboard || document.documentElement.classList.contains('rail-pending'))) {
      event.viewTransition.skipTransition();
    }
  });
  window.addEventListener('pagereveal', function (event) {
    if (event.viewTransition && document.documentElement.classList.contains('rail-pending')) {
      event.viewTransition.skipTransition();
    }
  });
})();
