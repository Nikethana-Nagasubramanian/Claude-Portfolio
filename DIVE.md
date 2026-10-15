# Dive Club review copy

The portfolio is a buildless static site hosted by Vercel, with `cleanUrls` and
`trailingSlash: false`. `/dive` is served from `dive/index.html`; review case
studies such as `/dive/gf`, `/dive/designing-charlie`, `/dive/scout`, and
`/dive/nutricopilot` are separate HTML documents. No framework conversion,
screenshots, iframe wrapper, or changes to public page sources are needed.

Regenerate the review snapshot from the current portfolio sources:

```sh
node tools/build-dive.mjs
python3 tests/dive-review.test.py
```

Commit `dive/` with the generator and checks. Publishing uses the existing
GitHub → Vercel production workflow on `main`; no Vercel configuration change
is needed. The generator refuses to overwrite an independently authored
`/dive` page or rewrite.

Every generated HTML head contains the exact scoped Inflight tag and a robots
`noindex, nofollow` directive. Review pages are absent from public navigation;
the repository has no sitemap to update. All review page links remain under
`/dive`, while external links and shared assets retain their existing targets.
Review-only copies of the shell scripts adapt the existing rail, router, and
dynamic asset paths. The small review link helper scopes links rendered by
existing tool bundles, including modified clicks.

Inflight activates when the public HTTPS review page is opened. Local HTTP
preview cannot activate a portfolio binding. No account or queue submission
is required to use the widget. Submit the final link at
https://inflight.co/portfolio only when ready to enter the live-review queue.
