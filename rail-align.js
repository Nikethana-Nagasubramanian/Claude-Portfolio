/* Keeps the rail headline's first line level with the first heading in the
   work column, whatever either one contains. The CSS value is a fallback; this
   measures both and writes --rail-headline-top, then follows any resize. */
(function () {
  var HEADLINE = ".home-rail .hero-headline, .site-rail .hero-headline";
  var TARGETS = ".home-work .work-title, .case-shell .case-title, .home-shell .hero-headline";


  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");

  /* Where the letters actually start, not where the line box does: two sizes
     with different line-heights carry different leading above the caps. */
  function capTop(element) {
    var box = element.getBoundingClientRect().top;
    var style = getComputedStyle(element);
    var fontSize = parseFloat(style.fontSize);
    var lineHeight = parseFloat(style.lineHeight);
    if (!lineHeight) lineHeight = fontSize * 1.2;
    ctx.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
    var metrics = ctx.measureText(element.textContent.trim().slice(0, 40) || "H");
    var ascent = metrics.fontBoundingBoxAscent || fontSize * 0.9;
    var descent = metrics.fontBoundingBoxDescent || fontSize * 0.25;
    var capAscent = metrics.actualBoundingBoxAscent || fontSize * 0.7;
    var baseline = box + (lineHeight - (ascent + descent)) / 2 + ascent;
    return baseline - capAscent;
  }

  function align() {
    var headline = document.querySelector(HEADLINE);
    if (!headline) return;
    var rail = headline.closest(".home-rail, .site-rail");
    if (!rail) return;

    // Below the rail breakpoint the two columns stack, so there is nothing to align to.
    if (window.innerWidth < 980) {
      headline.style.removeProperty("margin-top");
      return;
    }

    var target = null;
    var candidates = document.querySelectorAll(TARGETS);
    for (var i = 0; i < candidates.length; i += 1) {
      if (!rail.contains(candidates[i])) { target = candidates[i]; break; }
    }
    if (!target) return;

    // Apply, then check the result and correct the remainder: one pass can be
    // measured while the page is still settling.
    headline.style.marginTop = "0px";
    // Free space in the rail, measured with the footer unpinned from the bottom.
    var footer = rail.querySelector(".home-rail__footer, .site-rail__footer");
    var slack = Infinity;
    if (footer) {
      var pinned = footer.style.marginTop;
      footer.style.marginTop = "0px";
      var railBox = rail.getBoundingClientRect();
      var padBottom = parseFloat(getComputedStyle(rail).paddingBottom) || 0;
      var used = footer.getBoundingClientRect().bottom - railBox.top + padBottom;
      slack = Math.max(0, Math.round(rail.clientHeight - used));
      footer.style.marginTop = pinned || "";
    }
    var margin = Math.max(0, Math.round(capTop(target) - capTop(headline)));
    margin = Math.min(margin, slack);
    headline.style.marginTop = margin + "px";
    for (var pass = 0; pass < 3; pass += 1) {
      var residual = Math.round(capTop(target) - capTop(headline));
      if (residual === 0) break;
      margin = Math.min(Math.max(0, margin + residual), slack);
      headline.style.marginTop = margin + "px";
    }
  }

  var frame;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(align);
  }

  if (document.readyState === "complete") schedule();
  else {
    document.addEventListener("DOMContentLoaded", schedule);
    window.addEventListener("load", schedule);
  }
  window.addEventListener("resize", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  // Web fonts and images settle after first paint, so measure again once things stop moving.
  setTimeout(schedule, 300);
  setTimeout(schedule, 1200);
  // The hero animates in with a translate, which would be measured as position.
  document.addEventListener("animationend", function (event) {
    if (event.target.classList && event.target.classList.contains("hero--appear")) schedule();
  }, true);
  document.addEventListener("DOMContentLoaded", function () {
    var animated = document.querySelector(".hero--appear");
    if (!animated) return;
    if (animated.getAnimations) {
      var running = animated.getAnimations();
      for (var i = 0; i < running.length; i += 1) {
        if (running[i].finished) running[i].finished.then(schedule).catch(function () {});
      }
    }
  });
  if (window.ResizeObserver) {
    var observer = new ResizeObserver(schedule);
    document.addEventListener("DOMContentLoaded", function () {
      var target = document.querySelector(".home-work, .case-shell");
      if (target) observer.observe(target);
    });
  }
})();
