/* Rail interactions shared by every page that has a rail.

   Three jobs, all progressive enhancement over the markup already on the page:
   1. Collapse the two AI links into one CTA that opens a menu (hover on
      pointer devices, tap on touch).
   2. Move the rail's social links into a footer at the end of the content.
   3. Draw the nav's active-page square as one element that slides between
      items instead of appearing and disappearing.

   The home page and the generated rail use different class names, so every
   lookup below accepts either. */
(function () {
  var EASE = "cubic-bezier(.32,.72,0,1)";
  /* The Claude PNG is white art for the orange button, so it disappears on a
     light surface. This is the same mark drawn with currentColor. */
  var CLAUDE_ICON = '<svg class="ai-icon ai-icon--claude" viewBox="0 0 24 24" fill="#cb7c5d" aria-hidden="true"><path d="M10.50 10.00L12.00 1.40L13.50 10.00ZM11.70 9.52L17.30 2.82L14.30 11.02ZM12.98 9.70L21.18 6.70L14.48 12.30ZM14.00 10.50L22.60 12.00L14.00 13.50ZM14.48 11.70L21.18 17.30L12.98 14.30ZM14.30 12.98L17.30 21.18L11.70 14.48ZM13.50 14.00L12.00 22.60L10.50 14.00ZM12.30 14.48L6.70 21.18L9.70 12.98ZM11.02 14.30L2.82 17.30L9.52 11.70ZM10.00 13.50L1.40 12.00L10.00 10.50ZM9.52 12.30L2.82 6.70L11.02 9.70ZM9.70 11.02L6.70 2.82L12.30 9.52Z"/><circle cx="12" cy="12" r="2.1"/></svg>';
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
        '<div class="ai-menu" id="ai-menu" role="menu" hidden>' +
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
    var closeTimer;

    function open(state) {
      clearTimeout(closeTimer);
      if (state === cta.classList.contains("is-open")) return;
      cta.classList.toggle("is-open", state);
      trigger.setAttribute("aria-expanded", String(state));
      if (state) {
        menu.hidden = false;
      } else if (reduced.matches) {
        menu.hidden = true;
      } else {
        // Let the exit transition finish before hiding it from the tree.
        closeTimer = setTimeout(function () {
          if (!cta.classList.contains("is-open")) menu.hidden = true;
        }, 180);
      }
    }

    if (hoverable.matches) {
      var openTimer;
      cta.addEventListener("mouseenter", function () {
        clearTimeout(openTimer);
        openTimer = setTimeout(function () { open(true); }, 140);
      });
      cta.addEventListener("mouseleave", function () {
        clearTimeout(openTimer);
        open(false);
      });
    }
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      open(!cta.classList.contains("is-open"));
    });
    cta.addEventListener("focusin", function () { open(true); });
    cta.addEventListener("focusout", function () {
      setTimeout(function () {
        if (!cta.contains(document.activeElement)) open(false);
      }, 0);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && cta.classList.contains("is-open")) {
        open(false);
        trigger.focus();
      }
    });
    document.addEventListener("click", function (e) {
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

  /* ── 3. A square that travels between nav items ─────────────────── */
  function navMarker() {
    var nav = one(".home-rail__nav", ".site-rail__nav");
    if (!nav || nav.querySelector(".nav-marker")) return;

    var marker = document.createElement("span");
    marker.className = "nav-marker";
    marker.setAttribute("aria-hidden", "true");
    nav.appendChild(marker);

    function place(animate) {
      var current = nav.querySelector("a[aria-current='page']");
      if (!current) { marker.style.opacity = "0"; return; }
      var top = current.offsetTop + (current.offsetHeight - 8) / 2;
      marker.style.transition = animate && !reduced.matches
        ? "transform .42s " + EASE + ", opacity .2s ease"
        : "none";
      marker.style.transform = "translateY(" + top + "px)";
      marker.style.opacity = "1";
    }

    place(false);
    window.addEventListener("resize", function () { place(false); });
    // Exposed so the navigation layer can move the square on page change.
    nav.__placeMarker = place;
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
    }
    toggle.addEventListener("click", function () {
      setOpen(!document.body.classList.contains("rail-open"));
    });
    scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
    rail.addEventListener("click", function (e) {
      if (e.target.closest("a") && small.matches) setOpen(false);
    });

    /* Home's headline sits in the rail on desktop; on mobile that would bury
       it in the drawer, so it moves into the page instead. */
    var hero = document.querySelector(".hero");
    function placeHero() {
      if (!hero) return;
      var main = document.querySelector("main");
      if (!main) return;
      if (small.matches) {
        if (hero.parentNode !== main) main.insertBefore(hero, main.firstChild);
      } else if (hero.parentNode !== rail) {
        rail.insertBefore(hero, rail.querySelector(".site-rail__footer"));
      }
    }
    placeHero();
    small.addEventListener("change", function () {
      placeHero();
      if (!small.matches) setOpen(false);
    });
  }

  function init() {
    buildCta();
    moveSocial();
    navMarker();
    drawer();
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
