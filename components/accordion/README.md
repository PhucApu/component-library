# Accordion

A framework-free Web Component that turns `details` and `summary` into a group of disclosure
panels: an animated open and close, a heading and a region for every panel, arrow keys
between the headers, and one panel open at a time.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## Markup contract

```html
<ui-accordion>
  <details>
    <summary>What the panel is about</summary>
    <p>Whatever should be inside it.</p>
  </details>
  <details>
    <summary>The next one</summary>
    <p>Anything at all: text, a form, a row of buttons.</p>
  </details>
</ui-accordion>
```

That is the whole of it. Before any script runs, every panel already opens and closes,
reports its state, and answers <kbd>Enter</kbd> and <kbd>Space</kbd> — because it is the
native disclosure element rather than a rebuild of one.

The component supplies what is missing and leaves alone what you wrote:

| Written by you | Supplied where absent |
|---|---|
| `summary` and its content | A heading around the summary text |
| A heading inside the summary | A panel wrapper around everything else |
| `class="accordion__marker"` | A chevron that turns as the panel opens |
| `class="accordion__meta"` for secondary text | |

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `exclusive` | present | absent | Only one panel open at a time |
| `heading-level` | `2`–`6` | `3` | The heading supplied around a summary |
| `icon-placement` | `start`, `end` | `end` | Which side the marker sits on |
| `duration` | milliseconds | — | Fixes the length; without it, it follows the height |

On a `details`:

| Attribute | Effect |
|---|---|
| `open` | Open before the script runs, and it stays open without animating on arrival |
| `data-disabled` | Cannot be opened; the summary still takes focus and says it is unavailable |
| `name` | One panel at a time **before** the script arrives — see below |

## One panel at a time

Give the panels a shared `name` and the browser keeps one open on its own, with no script.
The component reads that as `exclusive`, removes the name, and takes the job over so it can
close the other panel with the same movement it opens this one.

```html
<ui-accordion exclusive>
  <details name="shipping" open>…</details>
  <details name="shipping">…</details>
</ui-accordion>
```

Writing both is the honest version: `name` is what works before the script, `exclusive` is
what works after it, and what you see does not change when the script arrives.

Opening a panel closes whichever was open, and that second change is announced politely. It
is a change nobody asked for, and it may be somewhere nobody is looking.

## Properties, methods, events

| Member | Notes |
|---|---|
| `items` | The `details` elements, in order |
| `expanded` | Which panels are open, by position; settable |
| `exclusive`, `headingLevel`, `iconPlacement`, `duration` | |
| `expand(i)` / `collapse(i)` / `toggle(i)` | |
| `expandAll()` / `collapseAll()` | In exclusive mode, `expandAll()` opens the first and no more |
| `labels` | Overrides the announcement |

| Event | Detail |
|---|---|
| `accordion-toggle` | `{ index, expanded, reason }` — `pointer` or `api` |
| `accordion-change` | `{ expanded, reason }` |

Both fire when the change is decided, not when the animation ends, and both report the
state that was decided rather than what the DOM says mid-animation.

## Keyboard

| Key | |
|---|---|
| `Enter` `Space` | Open or close the panel |
| `↑` `↓` | The header before or after, wrapping at both ends |
| `Home` `End` | The first or last header |

Arrow keys only apply while focus is on a summary; inside a panel they belong to whatever is
in there.

## Accessibility

- Every summary gets a **heading**, which is how most screen reader users move between
  panels. A summary on its own is a button and nothing more.
- Every panel gets `role="region"` named by its heading — but only while the group has six
  panels or fewer. The Authoring Practices asks for the role and then warns against breeding
  landmarks with it; the count is what decides.
- A disabled panel keeps its tab stop and says `aria-disabled`. A header nobody can reach is
  a header nobody can discover is unavailable.
- The marker is hidden from the tree and removed from a disabled summary, so the state is
  never carried by colour alone.

## Without JavaScript

Everything except the animation, the arrow keys, the region and the disabled panel. The
panels open, close, report their state, and — with `name` — still keep to one at a time.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the group follows the operating system. To pin it, narrow the
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

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `details`/`summary`,
`color-mix()`, and `light-dark()`. The `name` attribute on `details` is what an older browser ignores, and it
degrades to panels that all open independently.

## Motion

The panel's height moves, over a length that follows how far it has to travel — floored so a
short panel is not sluggish and capped so a long one does not feel broken. `duration` fixes
it instead. `prefers-reduced-motion: reduce` removes it entirely.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `accordion.html` | Runnable example |
| `accordion.css` | Every style |
| `accordion.js` | Rules, the custom element, and the demo bootstrap |
