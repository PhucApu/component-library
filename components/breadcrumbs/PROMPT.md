# Recreate Breadcrumbs

You are a Senior Frontend Engineer. Build a Web Component named `<ui-breadcrumbs>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

## The central instruction

`nav` carries the landmark, `ol` carries the ordering, and links already navigate. The
trail must work with no script at all. Add only the sizing hooks and the one thing CSS
cannot do: putting the middle of a long path behind a button.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement
is configuration, not a separate build.

- **Default**: a short trail, once ending in a link and once in plain text.
- **Separators**: the three built-in dividers beside one supplied by the consumer.
- **Icons**: levels carrying a leading decorative icon.
- **Collapsed**: a long path with its middle behind a button, and a short one that refuses
  to collapse.
- **Truncation**: long labels giving way inside a narrow container while the current page
  stays whole.
- **Sizes**: the standard and compact scales against the same path.

Each has to run on its own, loading nothing from another origin.

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
- Define every CSS custom property the component reads inside the component itself, and
  reference nothing outside it. That is what lets the trail be lifted into another project
  unchanged.
- There is no motion to remove. Animating a trail growing sideways only delays reading it.

## Verify before calling it done

Keep the rules that decide things — normalising an attribute, working out which levels to
hide, composing the button's name — reachable without a browser, so they can be tested on
their own. Cover the boundaries: a path shorter than the limit, one that would hide exactly
one level, and counts that overrun the path.

Check these explicitly, because each is a place this component quietly goes wrong:

- The divider does not appear in the accessibility tree, for every divider offered.
- With scripting disabled the trail is still a working set of links.
- The ellipsis is a button whose name counts what it hides, and pressing it reveals
  everything.
- A trail that would hide only one level does not collapse.
- The current page carries `aria-current="page"` whether or not the author wrote it.
