# Recreate Table

You are a Senior Frontend Engineer. Build a Web Component named `<ui-table>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

## The central instruction

`table`, `caption`, `thead`, `tbody`, and `th scope` already carry the structure assistive
technology navigates by. Rebuilding that out of `div` and `role` would be a downgrade.
Frame a native table; never rewrite it.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement
is configuration, not a separate build.

- **Default**: a captioned table with scoped headers and nothing depending on script.
- **Sortable**: columns cycling through ascending, descending, and source order, including
  a column with a blank cell.
- **Selectable**: row selection with a three-state header checkbox and one unavailable row.
- **Sticky**: a header that keeps its place, and its underline, while rows scroll.
- **Expandable**: rows opening a detail row that spans the columns.
- **Dense**: compact rows in a table wider than its column.

Each has to run on its own, loading nothing from another origin.

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
tab stop. Drive both directions from a `ResizeObserver`, and test both.

Set `min-inline-size: 0` on the host. A grid or flex item refuses by default to shrink
below its own content, so without it a wide table pushes the whole page sideways and the
scroll region never scrolls. Set it in the component: the consumer has no way to see why
their layout broke.

## Sorting

Three states — ascending, descending, and back to the order the data arrived in. Record
every row's source position before the first comparison runs, or there is no way back.

- Write `aria-sort` on the `th`, never on the button inside it. The state belongs to the
  column, not to the control that changes it.
- **Blank cells sort last in both directions.** No value is not a small value, and a column
  reversed into a wall of empty rows tells the reader nothing.
- Compare a column as numbers only when every value present parses as one. Let a cell
  override its own sort key with `data-sort-value`.
- Move a row and its detail row together. A detail separated from its parent is worse than
  no detail.

## Selection

The author writes the checkboxes so they still tick without script. The header checkbox has
three states, and partly selected exists **only as a JavaScript property** — writing
`indeterminate` in markup does nothing, which is how a partly selected table ends up
looking empty.

Count only the rows the header can actually operate. Counting an unavailable row against
the total leaves "select all" unable to reach "all": it ticks every row it can, finds the
count short, and immediately draws itself half-on again.

## Presentation and accessibility

- Use `border-collapse: separate`. A collapsed border belongs to whichever cell scrolls
  away first, so a sticky header loses its underline the moment it starts sticking.
- Keep the structure at every width and scroll sideways rather than restacking into cards.
  Row and column relationships are the point of a table.
- An expanded row's detail is a real `tr` spanning the columns, so it keeps its place in
  the reading order. The trigger carries `aria-expanded` and renames itself for what it
  will do next.
- Give the sort button and the scroll region visible focus rings.
- Only the expand chevron animates, at `160ms`; `prefers-reduced-motion: reduce` removes it.
- Define every CSS custom property the component reads inside the component itself, and
  reference nothing outside it. That is what lets the table be lifted into another project
  unchanged.

## Verify before calling it done

Keep the rules that decide things — normalising an attribute, the next sort state, ordering
two cells, deciding the header checkbox's state — reachable without a browser, so they can
be tested on their own.

Check these explicitly, because each is a place this component quietly goes wrong:

- The scroll region gains its tab stop when the table overflows **and loses it when it does
  not**. Measure both widths.
- Arrow keys actually move the scroll position once it has focus.
- Sorting cycles through three states and the third restores the source order.
- A blank cell stays last ascending **and** descending.
- `aria-sort` is on the header cell, and only on the active one.
- Selecting one row leaves the header checkbox `indeterminate`; pressing "select all"
  reaches "all" even with an unavailable row present.
- With scripting disabled the table is still readable and the scroll box still scrolls.
