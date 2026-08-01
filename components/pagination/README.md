# Pagination

A framework-free Web Component that builds a list of pages, keeps focus on something usable
after the list is rebuilt, and announces the page change that nothing else would report.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## Markup contract

```html
<ui-pagination page="1" count="10">
  <nav aria-label="Search results"></nav>
</ui-pagination>
```

Give the `nav` a name — a page can hold more than one pager, and "Search results" is what
tells them apart. Anything you put inside it is replaced when the component runs, so
server-rendered links can sit there as a no-script fallback.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `page` | number | `1` | Current page, clamped to the range |
| `count` | number | `1` | Total pages. Ignored when `total` and `page-size` are given |
| `page-size` | number | — | Rows per page; with `total`, derives `count` and the range |
| `total` | number | — | Total rows |
| `sibling-count` | number | `1` | Pages either side of the current one |
| `boundary-count` | number | `1` | Pages held at each end |
| `size` | `md`, `sm` | `md` | Control scale |
| `compact` | present | absent | State the position instead of listing pages |
| `show-first` / `show-last` | present | absent | Jumps to either end |
| `hide-prev` / `hide-next` | present | absent | Drop the arrows |
| `disabled` | present | absent | Make every control unavailable |

## Properties, methods, events

| Member | Notes |
|---|---|
| `page` | Read and write the current page |
| `count` | Total pages, derived when `total` and `page-size` are set |
| `range` | `{ start, end, total }` or `null` |
| `goTo(page)` | Move and report; returns `false` if already there |
| `labels` | Overrides every generated name |

`pagination-change` fires with `{ page, previous, count, range }`.

## It reports a page, not data

```js
document.querySelector('ui-pagination').addEventListener('pagination-change', (event) => {
  renderRows(event.detail.range);
});
```

What a page means for what is on screen is yours to decide. The Table variant shows one way:
a plain table redrawn from `range` on every change.

## Which pages are shown

`boundary-count` pages stay at each end, `sibling-count` sit either side of where you are,
and the rest collapse. When a gap would hide exactly **one** page, that page is shown
instead — a mark standing in for a single number is the same width and one fewer thing
anyone can reach.

At page 7 of 9 that gives `1 … 5 6 7 8 9`: collapsed on the left, and on the right page 8
simply stays.

## The ellipsis is not a button

Unlike a collapsed breadcrumb, the pages it stands for are still reachable — through the
neighbouring numbers and the arrows. A button there would be a tab stop leading nowhere new,
so it is marked `aria-hidden`.

## Focus after a page change

The list is rebuilt, so focus would be lost twice over: the control you pressed may be gone,
and the one that carried you to an end is now disabled. The component finds the same control
again and focuses it, falling back to the current page when it has gone or become
unavailable.

## Announcements

A `role="status"` region says "Page 3 of 6, showing 11 to 15 of 26" when the page moves.

It is **cleared** when something else changes the numbers underneath it — a new rows-per-page
value, say. The component knows a page moved; only you know why your own totals changed, so
announcing that is yours:

```js
element.labels = { announceRange: 'Page {page} of {count}, rows {start}-{end} of {total}' };
```

## Narrow screens

Nine controls do not fit in a phone-width column. `compact` states the position and keeps
the arrows, so every page is still reachable.

## Without JavaScript

Nothing. HTML has no pagination primitive, so unlike the form controls in this collection
there is nothing to fall back to. If a no-script path matters, server-render links inside
the `nav`; the component replaces them when it runs.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the control follows the operating system. To pin it, narrow the
`color-scheme` of any ancestor:

```css
:root {
  color-scheme: light;
}
```

`--pagination-on-accent` is the one colour that does not pair: the accent stays a
saturated indigo in both themes, so white keeps its contrast on it either way.

The example page also answers a frame that posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, which is how a host showing it in an
iframe keeps it in step. Nothing is sent back, and a page that never receives the message
keeps following the system.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `color-mix()`, and
`light-dark()`.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `pagination.html` | Runnable example |
| `pagination.css` | Every style |
| `pagination.js` | Rules, the custom element, and the demo bootstrap |
