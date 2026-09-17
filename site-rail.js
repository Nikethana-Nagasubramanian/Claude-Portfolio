/* Renders the left rail on every page that opts in with <body class="has-rail">.
   The home page keeps its own rail markup (it carries the headline too), so this
   script leaves a page alone when a rail is already present. */
(function () {
  var LINKS = [
    { href: "index.html", label: "Home" },
    { href: "about.html", label: "About Nike" },
    { href: "playground.html", label: "Playground" },
    { href: "archive.html", label: "Archived Projects" },
  ];

  var AI_PROMPT = "Read%20https%3A%2F%2Fitsmenike.com%2Fllms.txt%20and%20give%20me%20a%20concise%2C%20evidence-based%20assessment%20of%20Nikethana%20%28Nike%29%20for%20a%20Product%20Designer%20or%20Design%20Engineer%20role.%20Cite%20relevant%20projects%2C%20identify%20strengths%20and%20tradeoffs%2C%20and%20suggest%20interview%20questions.";

  function build() {
    var body = document.body;
    if (!body || !body.classList.contains("has-rail")) return;
    if (document.querySelector(".site-rail, .home-rail")) return;

    var page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
    var social = document.querySelector(".top-nav .social-links");

    var rail = document.createElement("aside");
    rail.className = "site-rail";
    rail.setAttribute("aria-label", "Introduction and contact");
    rail.innerHTML = [
      '<div class="hero-id">',
      '<img class="hero-avatar" src="https://framerusercontent.com/images/XShv5eucGw4h4i1NiLpatnvhZU.jpg?scale-down-to=512&width=3024&height=3024" alt="Nikethana (Nike)" />',
      '<p class="hero-name">Nikethana (Nike) <span>Product Builder</span></p>',
      '<p class="hero-status">Open for new opportunities</p>',
      "</div>",
      '<div class="site-rail__footer">',
      '<nav class="site-rail__nav" aria-label="Site links">',
      LINKS.map(function (link) {
        var current = link.href.replace(/\.html$/, "") === page ? ' aria-current="page"' : "";
        return '<a href="' + link.href + '"' + current + ">" + link.label + "</a>";
      }).join(""),
      "</nav>",
      '<div class="site-rail__ai" aria-label="Ask an AI about Nike\'s work">',
      '<a class="ai-button" href="https://chatgpt.com/?q=' + AI_PROMPT + '" target="_blank" rel="noopener"><img src="https://cdn.simpleicons.org/openai/292722" alt="" aria-hidden="true" />Chat with ChatGPT</a>',
      '<a class="ai-button" href="https://claude.ai/new?q=' + AI_PROMPT + '" target="_blank" rel="noopener"><img src="https://cdn.simpleicons.org/anthropic/292722" alt="" aria-hidden="true" />Chat with Claude</a>',
      "</div>",
      '<a class="site-rail__email" href="mailto:itsmenike3@gmail.com">itsmenike3@gmail.com</a>',
      '<div class="site-rail__social" aria-label="Social links"></div>',
      "</div>",
    ].join("");

    if (social) rail.querySelector(".site-rail__social").innerHTML = social.innerHTML;
    body.insertBefore(rail, body.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
