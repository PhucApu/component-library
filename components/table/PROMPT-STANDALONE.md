# Recreate Table as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-table>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It
is self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

`table`, `caption`, `thead`, `tbody`, and `th scope` already carry the structure assistive
technology navigates by. Rebuilding that out of `div` and `role` would be a downgrade.
Frame a native table; never rewrite it.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
table.html
table.css
table.js
README.md
```

- `table.js` is one ES module holding the DOM-free rules, the custom element, and the demo
  bootstrap. It defines the element only when it is not already registered.
- `table.css` holds every style, driven by component-owned CSS custom properties.
- `table.html` is a runnable example showing a sortable table, a selectable one, a sticky
  header, and rows with detail, reporting events into an `<output>`.
- `README.md` documents the markup contract, the attribute table, sorting, selection, and
  browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the
page must be served over HTTP or HTTPS, while noting the table itself would still be
readable.

## Markup contract

```html
<ui-table>
  <div class="table__scroll">
    <table>
      <caption>Recent orders</caption>
      <thead><tr><th scope="col">Order</th></tr></thead>
      <tbody><tr data-key="1001"><th scope="row">1001</th></tr></tbody>
    </table>
  </div>
</ui-table>
```

The scroll wrapper is written by the author, not created by script: it is what scrolls, and
it has to work before any script runs. Every body row carries a `data-key`, which is what
selection and detail report by.

## Public API

Support `density` (`comfortable` or `compact`), `sortable`, `selectable`, and
`sticky-header` as attributes. Expose `rows`, `selected`, `selectableRows`, `sort`, and
`labels`, plus `sortBy()`. Emit `table-sort`, `table-selection-change`, and
`table-row-toggle`.

## The scroll region, in both directions

A box with `overflow-x: auto` cannot be scrolled by anyone without a pointer unless it can
take focus. While the table is wider than its frame, give the wrapper `tabindex="0"`,
`role="region"`, and a name built from the caption.

**Take all three off again when it fits.** A tab stop that leads nowhere is worse than no
tab stop. Drive both directions from a `ResizeObserver`.

Set `min-inline-size: 0` on the host. A grid or flex item refuses by default to shrink
below its own content, so without it a wide table pushes the whole page sideways and the
scroll region never scrolls. Set it in the component: the consumer has no way to see why
their layout broke.

## Sorting

Three states — ascending, descending, and back to the order the data arrived in. Record
every row's source position before the first comparison runs, or there is no way back.

- Write `aria-sort` on the `th`, never on the button inside it.
- **Blank cells sort last in both directions.** No value is not a small value.
- Compare a column as numbers only when every value present parses as one. Let a cell
  override its own sort key with `data-sort-value`.
- Move a row and its detail row together.

## Selection

The author writes the checkboxes so they still tick without script. The header checkbox has
three states, and partly selected exists **only as a JavaScript property** — writing
`indeterminate` in markup does nothing.

Count only the rows the header can actually operate. Counting an unavailable row against
the total leaves "select all" unable to reach "all": it ticks every row it can, finds the
count short, and immediately draws itself half-on again.

## Presentation and accessibility

- Use `border-collapse: separate`. A collapsed border belongs to whichever cell scrolls
  away first, so a sticky header loses its underline the moment it starts sticking.
- Keep the structure at every width and scroll sideways rather than restacking into cards.
- An expanded row's detail is a real `tr` spanning the columns. The trigger carries
  `aria-expanded` and renames itself for what it will do next.
- Give the sort button and the scroll region visible focus rings.
- Only the expand chevron animates, at `160ms`; `prefers-reduced-motion: reduce` removes it.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Narrow the window until the table overflows: Tab reaches the scroll box and the arrow
  keys move it. Widen it again and that tab stop is gone.
- Press a sortable column three times and the rows come back to where they started.
- A row with a blank cell in the sorted column stays at the bottom either way.
- Tick one row: the header checkbox goes half-on. Press it: every available row ticks and
  it goes fully on, even though one row cannot be selected.
- Expand a row, then sort: the detail stays with its parent.
- Turn scripting off: the table is still readable and the scroll box still scrolls.
