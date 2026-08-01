# Breadcrumbs

A framework-free Web Component that styles a native trail of links, keeps the divider out
of the accessibility tree, and puts the middle of a long path behind a real button.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## Markup contract

```html
<ui-breadcrumbs>
  <nav aria-label="Breadcrumb">
    <ol class="breadcrumbs__list">
      <li><a href="/">Home</a></li>
      <li><a href="/library">Library</a></li>
      <li><a href="/library/data" aria-current="page">Data</a></li>
    </ol>
  </nav>
</ui-breadcrumbs>
```

- Write the `nav` and the `ol` yourself. They carry the landmark and the ordering, and the
  trail works before any script runs.
- Name the `nav`. A page can hold more than one, and "Breadcrumb" is what tells them apart.
- Mark the last level `aria-current="page"`. The component fills it in if you forget, but
  it belongs in your markup.
- The last level may be a link or a `span`. Both are correct.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `size` | `md`, `sm` | `md` | Text scale |
| `separator` | `slash`, `chevron`, `arrow` | `slash` | The divider |
| `max-items` | number | `0` | Collapse once the path is longer than this. `0` never collapses |
| `items-before-collapse` | number | `1` | Levels kept at the start |
| `items-after-collapse` | number | `1` | Levels kept at the end |
| `data-truncate` | present | absent | Ellipsise long labels instead of wrapping |

For any other divider, set the custom property directly:

```html
<ui-breadcrumbs style="--breadcrumbs-separator: '\2022'">
```

## Properties, methods, events

| Member | Notes |
|---|---|
| `expanded` | Whether the hidden levels have been revealed |
| `labels` | Overrides the expand button's name |
| `expand()` / `collapse()` | Reveal or re-hide the middle |

`breadcrumbs-expand` fires when the trail is opened.

## Collapsing

The first and last levels stay; the middle goes behind a button named for what it hides:

```js
element.labels = { expand: 'Show {count} more levels' };
```

A trail that would hide only **one** level does not collapse at all. Trading a level for a
press saves almost no width.

## The divider is never announced

It is generated content with empty alternative text, so a screen reader reads
"Home, Library, Data" rather than "Home slash Library slash Data". Nothing you need to do —
just do not add separator characters to your markup, because those would be read.

## Without JavaScript

Everything except collapsing. The trail is a landmark, an ordered list, and links; all of
that is in your markup. A trail with `max-items` set simply shows every level.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the trail follows the operating system. To pin it, narrow the
`color-scheme` of any ancestor:

```css
:root {
  color-scheme: light;
}
```

The example page also answers a frame that posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, which is how a host showing it in an
iframe keeps it in step. Nothing is sent back, and a page that never receives the message
keeps following the system.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `color-mix()`,
`light-dark()`, and the alternative-text form of `content`. Where that form is unsupported the divider is not drawn
at all, which is the safe way for it to fail.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `breadcrumbs.html` | Runnable example |
| `breadcrumbs.css` | Every style |
| `breadcrumbs.js` | Rules, the custom element, and the demo bootstrap |
