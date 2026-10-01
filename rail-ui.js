/* Rail interactions shared by every page that has a rail.

   Three jobs, all progressive enhancement over the markup already on the page:
   1. Collapse the two AI links into one CTA that opens a menu (hover on
      pointer devices, tap on touch).
   2. Keep the social footer and responsive header outside route content.
   3. Draw the nav's active-page square as one element that slides between
      items instead of appearing and disappearing.

   The four entry pages use the same generated rail. */
(function () {
  var CLAUDE_ICON = '<img class="ai-icon ai-icon--claude" src="assets/icons/claude-star.png?v=2" width="16" height="16" alt="" />';
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function one() {
    for (var i = 0; i < arguments.length; i++) {
      var el = document.querySelector(arguments[i]);
      if (el) return el;
    }
    return null;
  }

  /* ── 1. One CTA, two destinations ───────────────────────────────── */
  function buildCta() {
    var box = one(".home-ai-links", ".site-rail__ai");
    if (!box || box.querySelector(".ai-cta")) return;

    var gpt, claude, gptIcon = "", claudeIcon = CLAUDE_ICON;
    Array.prototype.forEach.call(box.querySelectorAll("a"), function (a) {
      if (a.href.indexOf("claude.ai") > -1) {
        claude = a.href;
      } else if (a.href.indexOf("chatgpt.com") > -1) {
        gpt = a.href;
        var svg = a.querySelector("svg");
        if (svg) gptIcon = svg.outerHTML;
      }
    });
    if (!gpt || !claude) return;

    box.innerHTML =
      '<div class="ai-cta">' +
        '<div class="ai-menu" id="ai-menu" role="menu" aria-label="AI providers" inert>' +
          '<a class="ai-menu__item" role="menuitem" href="' + claude + '" target="_blank" rel="noopener">' + claudeIcon + "Ask with Claude</a>" +
          '<a class="ai-menu__item" role="menuitem" href="' + gpt + '" target="_blank" rel="noopener">' + gptIcon + "Ask with GPT</a>" +
        "</div>" +
        '<button class="ai-cta__trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="ai-menu">' +
          '<span class="ai-cta__icons">' + claudeIcon + gptIcon + "</span>" +
          '<span class="ai-cta__label">Ask AI about Nike</span>' +
        "</button>" +
      "</div>";

    var cta = box.querySelector(".ai-cta");
    var trigger = cta.querySelector(".ai-cta__trigger");
    var menu = cta.querySelector(".ai-menu");
    var hoverable = window.matchMedia("(hover: hover) and (pointer: fine)");
    var openTimer, closeTimer;
    var pointerDown = false;
    var suppressFocus = false;
    var items = Array.from(menu.querySelectorAll('[role="menuitem"]'));

    function open(state, instant) {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      cta.classList.toggle("is-instant", !!instant);
      cta.classList.toggle("is-open", state);
      trigger.setAttribute("aria-expanded", String(state));
      menu.inert = !state;
      menu.setAttribute("aria-hidden", String(!state));
    }
    open(false, true);
    cta.addEventListener("pointerenter", function (e) {
      if (!hoverable.matches || e.pointerType === "touch") return;
      clearTimeout(closeTimer);
      openTimer = setTimeout(function () { open(true); }, 80);
    });
    cta.addEventListener("pointerleave", function () {
      clearTimeout(openTimer);
      if (cta.contains(document.activeElement)) return;
      closeTimer = setTimeout(function () { open(false); }, 120);
    });
    trigger.addEventListener("pointerdown", function () { pointerDown = true; });
    document.addEventListener("pointerup", function () { pointerDown = false; });
    document.addEventListener("pointercancel", function () { pointerDown = false; });
    trigger.addEventListener("click", function (e) {
      open(!cta.classList.contains("is-open"), e.detail === 0);
    });
    cta.addEventListener("focusin", function () {
      if (!pointerDown && !suppressFocus) open(true, true);
    });
    cta.addEventListener("focusout", function (e) {
      if (!cta.contains(e.relatedTarget)) open(false, true);
    });
    cta.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && cta.classList.contains("is-open")) {
        e.preventDefault();
        e.stopPropagation();
        suppressFocus = true;
        trigger.focus();
        suppressFocus = false;
        open(false, true);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        open(true, true);
        var index = items.indexOf(document.activeElement);
        if (e.key === "Home") index = 0;
        else if (e.key === "End") index = items.length - 1;
        else index = (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[index].focus();
      } else if (e.key === "Tab" && document.activeElement === trigger && !e.shiftKey && cta.classList.contains("is-open")) {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === "Tab" && document.activeElement === items[items.length - 1] && !e.shiftKey) {
        suppressFocus = true;
        trigger.focus();
        suppressFocus = false;
        open(false, true);
      }
    });
    document.addEventListener("pointerdown", function (e) {
      if (!cta.contains(e.target)) open(false);
    });
  }

  /* ── 2. Socials belong at the end of the page, not in the rail ───── */
  function moveSocial() {
    var social = one(".home-social-links", ".site-rail__social");
    if (!social || document.querySelector(".site-footer")) return;

    var labels = {
      linkedin: "LinkedIn", x: "X", twitter: "X", github: "GitHub",
      email: "Email", medium: "Medium"
    };
    var out = [];
    Array.prototype.forEach.call(social.querySelectorAll("a"), function (a) {
      var key = (a.getAttribute("aria-label") || "").toLowerCase();
      var label = labels[key] || a.getAttribute("aria-label") || "Link";
      out.push('<a href="' + a.getAttribute("href") + '"' +
        (a.target ? ' target="' + a.target + '" rel="noopener"' : "") +
        ">" + label + "</a>");
    });

    var footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.setAttribute("aria-label", "Social links");
    footer.innerHTML = '<nav class="site-footer__links" aria-label="Social links">' + out.join("") + "</nav>";
    document.body.appendChild(footer);
    social.parentNode.removeChild(social);
  }

  /* The marker is already in the shared markup. Fixed nav rows keep its
     geometry independent of font loading; only user clicks enable motion. */
  function navMarker() {
    var nav = document.querySelector('.site-rail__nav');
    if (!nav) return;
    var marker = nav.querySelector('.nav-marker');
    function place(animate) {
      var current = nav.querySelector('[aria-current="page"]');
      nav.classList.toggle('marker-animated', !!animate && !reduced.matches);
      if (current) marker.style.transform = 'translateY(' + (current.offsetTop + (current.offsetHeight - 8) / 2) + 'px)';
      marker.dataset.ready = String(!!current);
      nav.classList.add('marker-positioned');
    }
    place(false);
    window.addEventListener('resize', function () { place(false); });
    reduced.addEventListener('change', function () { place(false); });
    document.addEventListener('site:navigation', function (e) { place(e.detail.animate); });
  }

  function portrait() {
    var trigger = document.querySelector('.nike-preview');
    var rail = document.querySelector('.site-rail');
    var identity = document.querySelector('.hero-id');
    var photo = document.createElement('div');
    photo.className = 'nike-photo';
    photo.id = 'nike-portrait';
    photo.innerHTML = '<img src="assets/nike-portrait.jpg" alt="Nike" width="520" height="693" loading="eager" decoding="async">';
    rail.insertBefore(photo, rail.querySelector('.site-rail__footer'));
    var hover = matchMedia('(hover: hover) and (pointer: fine)');
    var pointer = false;
    var touch = false;
    function place() {
      if (!rail.contains(identity)) return;
      photo.style.top = identity.offsetTop + identity.offsetHeight + 24 + 'px';
    }
    function show(open, instant) {
      if (open) place();
      photo.classList.toggle('is-visible', open);
      photo.classList.toggle('is-instant', !!instant);
      photo.setAttribute('aria-hidden', String(!open));
      trigger.setAttribute('aria-expanded', String(open));
    }
    place();
    if (document.fonts) document.fonts.ready.then(place);
    show(false);
    trigger.addEventListener('pointerenter', function (e) { if (hover.matches && e.pointerType !== 'touch') show(true); });
    trigger.addEventListener('pointerleave', function () { if (!trigger.matches(':focus-visible')) show(false); });
    trigger.addEventListener('pointerdown', function (e) { pointer = true; touch = e.pointerType === 'touch'; });
    trigger.addEventListener('focus', function () { if (!pointer) show(true, true); });
    trigger.addEventListener('blur', function () { show(false, true); pointer = false; });
    trigger.addEventListener('click', function (e) {
      if (touch || !hover.matches || e.detail === 0) show(trigger.getAttribute('aria-expanded') !== 'true', e.detail === 0);
      pointer = false;
    });
    document.addEventListener('pointerdown', function (e) { if (!trigger.contains(e.target)) show(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') show(false, true); });
    document.addEventListener('site:routechange', function () { show(false, true); });
    window.addEventListener('resize', function () { place(); show(false, true); });
  }

  /* ── 4. Mobile: the rail is a drawer behind a floating hamburger ─── */
  function drawer() {
    var rail = document.querySelector(".site-rail");
    if (!rail || document.querySelector(".rail-toggle")) return;
    var small = window.matchMedia("(max-width: 979px)");

    var toggle = document.createElement("button");
    toggle.className = "rail-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "site-rail");
    toggle.innerHTML = "<span></span><span></span><span></span>";

    var scrim = document.createElement("div");
    scrim.className = "rail-scrim";
    rail.id = rail.id || "site-rail";
    document.body.appendChild(scrim);
    document.body.appendChild(toggle);

    function setOpen(state) {
      document.body.classList.toggle("rail-open", state);
      toggle.setAttribute("aria-expanded", String(state));
      toggle.setAttribute("aria-label", state ? "Close menu" : "Menu");
      rail.inert = small.matches && !state;
      document.querySelector("main").inert = small.matches && state;
      var header = document.querySelector(".mobile-shell-header");
      if (header) header.inert = small.matches && state;
      var footer = document.querySelector("body > .site-footer");
      if (footer) footer.inert = small.matches && state;
      if (state) rail.querySelector("button, a").focus();
      else if (rail.contains(document.activeElement)) toggle.focus();
    }
    document.addEventListener("site:routechange", function () { setOpen(false); });
    setOpen(false);
    toggle.addEventListener("click", function () {
      setOpen(!document.body.classList.contains("rail-open"));
    });
    scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && small.matches && document.body.classList.contains("rail-open")) {
        var focusable = Array.from(rail.querySelectorAll('a, button')).filter(function (el) { return !el.closest('[inert]'); });
        if (!e.shiftKey && document.activeElement === toggle) { e.preventDefault(); focusable[0].focus(); }
        else if (e.shiftKey && document.activeElement === focusable[0]) { e.preventDefault(); toggle.focus(); }
      }
    });
    rail.addEventListener("click", function (e) {
      if (e.target.closest("a") && !e.target.closest(".site-rail__nav") && small.matches) setOpen(false);
    });

    var main = document.querySelector("main");
    var identity = rail.querySelector(".hero-id");
    var top = rail.querySelector(".rail-top");
    var intro = document.createElement("div");
    intro.className = "mobile-shell-header";
    main.before(intro);
    function placeIntro() {
      if (small.matches) {
        intro.appendChild(top);
        intro.appendChild(identity);
      } else {
        rail.insertBefore(top, rail.firstChild);
        top.after(identity);
      }
    }
    placeIntro();
    small.addEventListener("change", function () {
      placeIntro();
      setOpen(false);
    });
  }

  function init() {
    buildCta();
    moveSocial();
    drawer();
    navMarker();
    portrait();
    document.body.classList.add("rail-ready");
  }


  init();
})();
