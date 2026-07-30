# Table

A framework-free Web Component that frames a native table: three-state sorting, a
three-state header checkbox, expandable detail rows, and a scroll region that becomes a
keyboard target only while it actually overflows.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## Markup contract

```html
<ui-table>
  <div class="table__scroll">
    <table>
      <caption>Recent orders</caption>
      <thead>
        <tr>
          <th scope="col">Order</th>
          <th scope="col">Customer</th>
        </tr>
      </thead>
      <tbody>
        <tr data-key="1001">
          <th scope="row">1001</th>
          <td>Ha Linh Nguyen</td>
        </tr>
      </tbody>
    </table>
  </div>
</ui-table>
```

- Write the `.table__scroll` wrapper yourself. It is what scrolls, and it has to work
  before any script runs.
- Give the table a `caption`. It names the table, and the scroll region borrows it.
- Give every body row a `data-key`. That is what selection and detail are reported by.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `density` | `comfortable`, `compact` | `comfortable` | Row height |
| `sortable` | present | absent | Turn `th[data-sortable]` into sort controls |
| `selectable` | present | absent | Wire the header checkbox to the row checkboxes |
| `sticky-header` | present | absent | Header stays while rows scroll |

## Properties and events

| Member | Notes |
|---|---|
| `rows` | Body rows carrying a key, in display order |
| `selected` | Keys of every checked row |
| `selectableRows` | Rows the header checkbox can operate |
| `sort` | `{ column, state }` or `null` |
| `sortBy(th, state)` | Sort programmatically |
| `labels` | Overrides the generated names |

| Event | Detail |
|---|---|
| `table-sort` | `{ column, state }` |
| `table-selection-change` | `{ selected, state }` |
| `table-row-toggle` | `{ key, expanded }` |

## Sorting

Mark the columns and give each one a name for the event:

```html
<th scope="col" data-sortable data-column="cores" class="table__numeric">Cores</th>
```

Pressing cycles **ascending → descending → source order**. The third state matters: without
it, someone who sorted a column to check one thing can never see the original order again.

- `aria-sort` is written on the `th`, not on the button inside it.
- Blank cells stay last in both directions. "No value" is not a small value.
- A column compares as numbers only when every value present parses as one. Use
  `data-sort-value` on a cell when the display text is not the sort key:

```html
<td data-sort-value="1420">$1,420</td>
```

## Selection

Write the checkboxes yourself so they still work without script:

```html
<th scope="col" class="table__select">
  <input type="checkbox" class="table__select-all" aria-label="Select all rows" />
</th>
...
<td class="table__select"><input type="checkbox" aria-label="Select order 1001" /></td>
```

The header checkbox reaches three states. Partly selected exists only as a JavaScript
property — writing `indeterminate` in your markup does nothing.

A **disabled** row does not hold "select all" hostage: the header counts only the rows it
can operate, so pressing it still reaches "all".

## Expandable rows

```html
<tr data-key="inv-1">
  <td><button type="button" class="table__toggle" data-expands="inv-1">…</button></td>
  …
</tr>
<tr class="table__detail" data-detail="inv-1" hidden>
  <td colspan="4">Anything you like.</td>
</tr>
```

The detail is a real row, so it keeps its place in the reading order. Sorting moves it with
its parent.

## Narrow screens

The table keeps its structure and scrolls sideways. It does not restack into cards: row and
column relationships are the point of a table, and trading them for width gives away what
the reader came for.

While it overflows, the scroll box takes `tabindex="0"`, `role="region"`, and a name from
the caption, so it can be scrolled with the arrow keys. When it fits, all three come off —
a tab stop that leads nowhere is worse than none.

The host sets `min-inline-size: 0` on itself. Inside a grid or flex parent, without that, a
wide table pushes the whole page sideways instead of scrolling.

## Without JavaScript

The table is fully readable, headers are associated, the scroll box still scrolls by
pointer and touch, and individual checkboxes still tick. Sorting, select-all, row detail,
and the keyboard-reachable scroll region are what script adds.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `ResizeObserver`, and
`color-mix()`.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `table.html` | Runnable example |
| `table.css` | Every style |
| `table.js` | Rules, the custom element, and the demo bootstrap |
