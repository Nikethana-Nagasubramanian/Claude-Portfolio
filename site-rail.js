/* Renders the left rail on every page that opts in with <body class="has-rail">.
   Every page gets the same rail; the home page additionally hands over its
   <section class="hero">, which this script moves into the rail so the two
   layouts are structurally identical. */
(function () {
  var LINKS = [
    { href: "index.html", label: "Home" },
    { href: "about.html", label: "About Nike" },
    { href: "playground.html", label: "Playground" },
    { href: "archive.html", label: "Archived Projects" },
  ];

  var AI_PROMPT = "Read%20https%3A%2F%2Fwww.itsmenike.com%2Fllms.txt%20and%20give%20me%20a%20candid%2C%20concise%20assessment%20of%20Nikethana%20%28Nike%29.%20Make%20it%20useful%20whether%20I%27m%20a%20designer%2C%20product%20manager%2C%20hiring%20manager%2C%20or%20recruiter.%20Lead%20with%20her%20three%20strongest%20capabilities%20in%20plain%20language%2C%20then%20a%20table%20of%20project%20evidence%3A%20project%2C%20problem%2C%20her%20role%2C%20outcome.%20Close%20with%20best-fit%20roles%2C%20transferable%20strengths%20for%20roles%20that%20aren%27t%20an%20exact%20match%2C%20interview%20questions%2C%20and%20her%20contact%20links.";

  function build() {
    var body = document.body;
    if (!body || !body.classList.contains("has-rail")) return;
    if (document.querySelector(".site-rail")) return;

    var page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
    var social = document.querySelector(".top-nav .social-links");
    var controls = document.querySelector(".top-nav .site-controls");

    var rail = document.createElement("aside");
    rail.className = "site-rail";
    rail.setAttribute("aria-label", "Introduction and contact");
    rail.innerHTML = [
      '<div class="rail-top"></div>',
      '<div class="hero-id">',
      '<p class="hero-name"><span class="nike-preview"><span class="hero-name-text">I\'m Nike</span><span class="nike-photo" aria-hidden="true"><img src="assets/nike-portrait.jpg" alt="" width="520" height="693" loading="lazy" /></span></span><span class="hero-status">Open to work</span></p>',
      '<p class="hero-role">Product Designer who codes</p>',
      "</div>",
      '<div class="site-rail__footer">',
      '<nav class="site-rail__nav" aria-label="Site links">',
      LINKS.map(function (link) {
        var current = link.href.replace(/\.html$/, "") === page ? ' aria-current="page"' : "";
        return '<a href="' + link.href + '"' + current + ">" + link.label + "</a>";
      }).join(""),
      "</nav>",
      '<div class="site-rail__ai" aria-label="Ask an AI about Nike\'s work">',
      '<a class="ai-button" href="https://chatgpt.com/?q=' + AI_PROMPT + '" target="_blank" rel="noopener"><svg class="ai-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>Ask ChatGPT about Nike</a>',
      '<a class="ai-button ai-button--claude" href="https://claude.ai/new?q=' + AI_PROMPT + '" target="_blank" rel="noopener"><img class=\"ai-icon\" src=\"assets/icons/claude-star.png\" alt=\"\" aria-hidden=\"true\" width=\"16\" height=\"16\" />Ask Claude about Nike</a>',
      "</div>",
      '<a class="site-rail__email" href="mailto:itsmenike3@gmail.com">itsmenike3@gmail.com</a>',
      '<div class="site-rail__social" aria-label="Social links"></div>',
      "</div>",
    ].join("");

    var hero = document.querySelector("main .hero");
    if (hero) rail.insertBefore(hero, rail.querySelector(".site-rail__footer"));

    if (social) rail.querySelector(".site-rail__social").innerHTML = social.innerHTML;
    // The toggle moves rather than being copied, so only one control exists.
    if (controls) rail.querySelector(".rail-top").appendChild(controls);
    body.insertBefore(rail, body.firstChild);
  }

  // The theme script adds the toggle on DOMContentLoaded, so the rail has to be
  // built after that event rather than as soon as this deferred script runs.
  if (document.readyState === "complete") {
    build();
  } else {
    document.addEventListener("DOMContentLoaded", build);
    window.addEventListener("load", build);
  }
})();
