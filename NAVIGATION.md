# Portfolio navigation

The four entry documents (`index.html`, `about.html`, `playground.html`, and
`archive.html`) remain independently renderable static HTML. `site-router.js`
progressively enhances links between these four routes. Case studies, tools,
external destinations, modified clicks, downloads, and new-tab links remain
native browser navigations. Existing Vercel clean-URL rewrites remain intact.

## Why this architecture

Previously, `rail-ui.js` waited 300 ms before `location.assign`. Each destination
then injected its rail, moved Home content into it, moved controls at responsive
breakpoints, measured the marker in an animation frame, and removed the
`rail-pending` visibility gate. Cross-document View Transitions attempted to
animate across these different document/layout states. Removing only the timer
would not have removed the rebuilding and hiding phases.

A small static router fits four editorial pages with no shared application data.
Next.js App Router would provide persistent layouts and framework routing, but
would require converting HTML to React, adding a build pipeline, and maintaining
framework dependencies. Reconsider a framework if the portfolio grows into a
stateful application or needs extensive nested routes and server rendering.

References:
- https://nextjs.org/docs/app/getting-started/layouts-and-pages
- https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API
- https://shreygups.com/ (interaction reference, not a visual copy or a verified claim about its implementation)

## Ownership and maintenance

- `site-rail.js`: builds one sidebar. Home's introduction stays inside main.
- `rail-ui.js`: persistent AI menu, marker, mobile drawer/header, social footer,
  and a focusable portrait control. The eager portrait lives under body so a
  blurred/overflow-clipped rail cannot crop it.
- `site-router.js`: four-route allowlist, document prefetch/cache, latest-request
  protection, History API, title/description, focus, scroll/tab restoration,
  controlled route initializers. It never executes fetched
  scripts. Add future route behavior to `initialize()` with corresponding cleanup if needed.
- `site-shell.css`: the single route frame: 1080px maximum including 48px side
  padding and 64px top padding; below 980px, 24px side and 28px top padding under
  the persistent mobile header. Content can vary within that frame.
- All four documents load the same CSS in the same order. Update their shared
  asset versions together. Cross-document transitions are disabled on these four
  documents; independent case-study files are unchanged.
- `atmosphere.js` remains mounted; CSS enables the day/night scenery only on
  Home and About. Pause/theme preference persists across route changes.

Cached routes commit synchronously without hiding main. If a route has not yet
been fetched, the existing content stays visible with `aria-busy` and a polite
status until the response arrives. Fetch failures fall back to native navigation.
This is not a promise that an uncached/offline destination has zero network latency.
The nav marker uses an interruptible 180ms transform; keyboard and reduced-motion
navigation update it without travel. Main content has no generic fade.

## Verification

Run `python3 -m http.server 8080` from the repository, then open
`http://localhost:8080/tests/navigation.html` and select **Run checks**.
The browser fixture asserts actual DOM identity across six navigations, stable
frame and stylesheet geometry, immediate active state, heading focus, Back/Forward
scroll and tab restoration, rapid navigation, portrait input handlers and dismissal,
and modified-click behavior. Portrait touch/hover events in this fixture are
synthetic; real hardware testing remains useful.

`node --test tests/rail-marker.test.cjs` checks synchronous positioning,
retargeting, resize, keyboard and reduced-motion marker behavior.

Verified locally: browser fixture passes; all four routes at desktop and 390px;
mobile Back/Forward; no horizontal overflow at 390px; direct document loads;
JavaScript syntax checks and `git diff --check`.
Production deployment, real touch hardware, and a full cross-browser matrix were
not run. No framework dependencies were added, and no deployment was performed.

The SVG day/night skies live in `assets/atmosphere/day-sky.svg` and
`night-sky.svg`. Their contours are static; only six stars animate opacity.
About uses a compact responsive resume action, no in-page navigation, and no
duplicate contact footer. The persistent footer owns all four routes’ social links.

Background exploration is owned by `background-explorer.js` and
`background-explorer.css`. Home and About expose a hero button. A native dialog
shows the existing PNG artwork uncropped, keeps the portfolio inert, and restores
focus and scroll on dismissal. City notes use the confirmed 2022 Boston and 2026
New Orleans move dates; the temple illustration is not labeled as a specific temple.
Day links use a darker blue and separators have independent light/dark values.
