# Flip Book

A stack of pages that turns like a book. Every leaf carries two pages, front and back, so a
turn leaves one page on the left and shows the next on the right. Take a page with the
pointer and it follows your hand round the spine; the arrows either side do the same thing a
leaf at a time.

## Markup contract

Write a list of pages. The element pairs them into leaves and builds the book:

```html
<link rel="stylesheet" href="flip-book.css" />
<script type="module" src="flip-book.js"></script>

<ui-flip-book label="Eight plates">
  <ul>
    <li><img src="assets/cover-tide.svg" alt="A high tide under a low sun" /></li>
    <li><img src="assets/dawn-fields.svg" alt="Ploughed fields at dawn" /></li>
    <li><img src="assets/pine-dark.svg" alt="Dark pines on a pale slope" /></li>
  </ul>
</ui-flip-book>
```

Each child of the first `<ul>` or `<ol>` is one page, and a page is whatever you wrote — a
picture, a heading, a paragraph with a link in it. Pages are **moved** into the leaves rather
than copied, so anything already bound to them keeps working. An odd number of pages ends on
a blank back, as it would in print.

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `page` | `1` | The first page currently readable. Reflected, so it always says where the book is. |
| `duration` | `520` | How long a whole turn takes, in milliseconds. Clamped to `120`–`2000`. |
| `no-drag` | absent | Takes the gesture away and leaves the arrows and the keyboard. |
| `label` | `Flip book` | Accessible name for the book. |

## Properties, methods, events

- `page` — get or set the first readable page.
- `pages` — how many pages there are.
- `leaves` — how many leaves that makes.
- `turned` — how many leaves have been turned, which is the whole state of the book.
- `next()` / `previous()` — turn one leaf.
- `goTo(page)` — one leaf away turns; further than that opens the book there without a flip,
  because riffling six leaves to answer one call is a wait rather than an animation.
- `flip-change` — fired when a turn lands. `detail` carries `{ page, pages }`.

## Turning by hand

Pull left to turn a page forward, right to put one back. Which leaf is taken depends on the
direction your hand went, not on where it landed. The leaf follows the pointer round the
spine, and when you let go two things can commit the turn: being past half way, or still
moving quickly. Distance alone would throw away the short flick that is how most people turn
a page.

A leaf let go part way through carries on from the angle it is at, rather than restarting.
A drag across a link never follows the link.

## Keyboard

The stage takes three tab stops: the book itself and the two arrows.

| Key | Does |
|---|---|
| <kbd>←</kbd> / <kbd>↑</kbd> | Turns back a leaf |
| <kbd>→</kbd> / <kbd>↓</kbd> | Turns on a leaf |
| <kbd>Home</kbd> / <kbd>End</kbd> | Opens at the first or last page |

## Accessibility

- The book is a `group` carrying `label`; the arrows are named `Previous page` and
  `Next page` and are disabled at the ends, because an end of a book is a real end.
- A polite status region reports `Pages 2 and 3 of 8` once a turn lands — not during it.
- Pages keep their own semantics: a heading is still a heading and a link is still a link.
- `prefers-reduced-motion: reduce` makes a turn arrive without travelling. Dragging still
  works and lands the moment it is let go.

## Without JavaScript

The pages are an ordinary list, and the stylesheet leaves them as a plain responsive grid
until the element upgrades. Nothing is hidden behind the script.

## Light and dark

Every colour resolves through `light-dark()`, so the component follows the operating system
on its own. An embedding page that wants to pin one theme posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }` to the frame, which narrows `color-scheme`.
The pictures do not change with the theme.

## Responsive

The spread is two pages wide. Below `34rem` there is no room for the second, so the spine
moves to the edge of the stage: one page fills it and a turning leaf sweeps off the side.

## Browser support

Needs custom elements, CSS 3D transforms with `transform-style: preserve-3d`, Pointer Events
and `light-dark()`: Chrome and Edge 123+, Safari 17.5+, Firefox 128+.

## Running the files

Open `flip-book.html` from a local server so the module and the pictures load over HTTP.

## Files

| File | Holds |
|---|---|
| `flip-book.html` | The demo page |
| `flip-book.css` | The book, its custom properties, and the demo page chrome |
| `flip-book.js` | The element, its rules, and the demo wiring |
| `assets/` | The plates the demo shows |
