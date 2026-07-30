# Recreate Breadcrumbs as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-breadcrumbs>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It
is self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

`nav` carries the landmark, `ol` carries the ordering, and links already navigate. The
trail must work with no script at all. Add only the sizing hooks and the one thing CSS
cannot do: putting the middle of a long path behind a button.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
breadcrumbs.html
breadcrumbs.css
breadcrumbs.js
README.md
```

- `breadcrumbs.js` is one ES module holding the DOM-free rules, the custom element, and the
  demo bootstrap. It defines the element only when it is not already registered.
- `breadcrumbs.css` holds every style, driven by component-owned CSS custom properties.
- `breadcrumbs.html` is a runnable example showing a short trail, each divider, a collapsed
  path, and a truncated one.
- `README.md` documents the markup contract, the attribute table, and browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the
page must be served over HTTP or HTTPS, while noting the links themselves would still work.

## Markup contract

```html
<ui-breadcrumbs>
  <nav aria-label="Breadcrumb">
    <ol class="breadcrumbs__list">
      <li><a href="/">Home</a></li>
      <li><a href="/library/data" aria-current="page">Data</a></li>
    </ol>
  </nav>
</ui-breadcrumbs>
```

The last level may be a link or a `span`; both are correct. Fill in a missing
`aria-current="page"` as a safety net, but write it in every documented example.

## Public API

Support `size` (`md` or `sm`), `separator` (`slash`, `chevron`, or `arrow`), `max-items`,
`items-before-collapse`, `items-after-collapse`, and `data-truncate` as attributes. Expose
`expanded` and `labels`, plus `expand()` and `collapse()`. Emit `breadcrumbs-expand`.

Allow any other divider through a custom property rather than an attribute enumeration.

## The divider is never read aloud

A trail announced as "Home slash Library slash Reports" buries the words that matter. Draw
the divider as generated content with an **empty alternative text**:

```css
content: var(--breadcrumbs-separator) / "";
```

Generated content is exposed to assistive technology by default; the `/ ""` is what removes
it. Verify against the accessibility tree the browser actually exposes rather than assuming
it worked. Where the syntax is unsupported the declaration is invalid and no divider is
drawn, which is the safe direction to fail in.

Never put separator characters in the markup: those are read.

## Collapsing

- The mark standing in for the hidden levels is a **`button`**, not a character. A static
  ellipsis leaves those levels unreachable by pointer, keyboard, and screen reader alike.
- Name it for what it hides — "Show 4 hidden levels" — and let the count come from the
  model rather than from the markup.
- **Refuse to collapse when only one level would go away.** Trading a level for a press
  saves almost no width.
- Pressing it reveals the whole path in place rather than opening a menu.

## Presentation and accessibility

- Keep the collapse decision in a rule that never touches the DOM, so the arithmetic can be
  tested on its own.
- In a narrow column, let earlier levels ellipsise and never the current one: that is the
  piece of the trail that has to stay readable. Keep the full text reachable through the
  link's own `title`.
- Give the links a visible focus ring and a hover state that does not rely on colour alone.
- There is no motion to remove. Animating a trail growing sideways only delays reading it.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- The accessibility inspector shows the labels and no dividers between them.
- Turn scripting off: the trail is still a working set of links.
- Tab reaches the ellipsis button, and pressing it reveals the whole path.
- A trail set to hide only one level stays whole.
- The current page is marked, whether you wrote the attribute or not.
- A long label in a narrow column ellipsises, and the current page still does not.
