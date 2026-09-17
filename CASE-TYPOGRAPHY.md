# Case-study typography

`case-typography.css` is the reusable, scoped typography layer for portfolio case studies. It keeps the calm Geist treatment from Paper without making every page look identical.

## Use it

Load Geist and Geist Mono, then load the stylesheet after any page-specific styles:

```html
<link rel="stylesheet" href="/case-typography.css">
<main class="case-type">
  <article class="case-reading-width case-copy">
    <p>Body copy is 16 / 26 with deliberately quiet tracking.</p>
  </article>
</main>
```

Use these semantic classes instead of repeating type declarations:

| Class | Role |
| --- | --- |
| `.case-reading-width` | Keeps reading measure at 586px. |
| `.case-copy` | Case-study body copy and paragraph rhythm. |
| `.case-section-heading` | A section heading, 20 / 28 medium. |
| `.case-display` | A larger proposition or pull quote, 29 / 38 medium. |
| `.case-project-title` | Project/card heading, 16 / 24 medium. |
| `.case-meta` | Supporting metadata, 12 / 20. |
| `.case-mono` | Technical labels or annotations in Geist Mono. |

## Tune a single case

Override tokens on that case’s `.case-type` wrapper. Preserve the scale relationship before changing individual classes.

```css
.case-type.case-type--wide {
  --case-copy-width: 680px;
  --case-copy-gap: 28px;
  --case-link: #3f7ff4;
}
```

Paper is the reference implementation: it loads the system and maps its existing page-specific components to these tokens.
