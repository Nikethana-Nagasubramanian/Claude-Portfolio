/* Rail interactions shared by every page that has a rail.

   Three jobs, all progressive enhancement over the markup already on the page:
   1. Collapse the two AI links into one CTA that opens a menu (hover on
      pointer devices, tap on touch).
   2. Move the rail's social links into a footer at the end of the content.
   3. Draw the nav's active-page square as one element that slides between
      items instead of appearing and disappearing.

   The four entry pages use the same generated rail. */
(function () {
  var CLAUDE_ICON = '<img class="ai-icon ai-icon--claude" src="assets/icons/claude-star.png" width="16" height="16" alt="" />';
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
    var pane = one(".home-work", "main.home-shell", "main");
    if (!social || !pane || document.querySelector(".site-footer")) return;

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
    footer.innerHTML = out.join("");
    pane.appendChild(footer);
    social.parentNode.removeChild(social);
  }

  /* The marker is already in the shared markup. Fixed nav rows keep its
     geometry independent of font loading; only user clicks enable motion. */
  function navMarker() {
    var nav = document.querySelector(".site-rail__nav");
    if (!nav) return;
    var marker = nav.querySelector(".nav-marker");
    var frame, navigationTimer;
    var current = nav.querySelector("a[aria-current='page']");
    function place(link) {
      marker.style.transform = "translateY(" + (link.offsetTop + (link.offsetHeight - 8) / 2) + "px)";
    }
    function settle() {
      nav.classList.remove("marker-animated");
      if (current) place(current);
      marker.dataset.ready = String(!!current);
      nav.classList.add("marker-positioned");
      document.documentElement.classList.remove("rail-pending");
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(settle);
    }
    schedule();
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) { clearTimeout(navigationTimer); schedule(); }
    });
    nav.addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target || link.hasAttribute("download")) return;
      clearTimeout(navigationTimer);
      if (link === current || e.detail === 0 || reduced.matches) return;
      e.preventDefault();
      nav.classList.add("marker-animated");
      place(link);
      // Finish this one short movement before the native document navigation.
      // The destination paints its marker directly in the matching position.
      navigationTimer = setTimeout(function () { location.assign(link.href); }, 300);
    });
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
      if (state) rail.querySelector("button, a").focus();
      else if (rail.contains(document.activeElement)) toggle.focus();
    }
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
    var hero = rail.querySelector(".hero");
    var identity = rail.querySelector(".hero-id");
    var top = rail.querySelector(".rail-top");
    var intro = document.createElement("div");
    intro.className = "mobile-home-intro";
    main.insertBefore(intro, main.firstChild);
    function placeIntro() {
      if (small.matches) {
        intro.appendChild(top);
        intro.appendChild(identity);
        if (hero) intro.appendChild(hero);
      } else {
        rail.insertBefore(top, rail.firstChild);
        top.after(identity);
        if (hero) identity.after(hero);
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
    document.body.classList.add("rail-ready");
  }


  init();
})();
