# Table - Design Specification

## 1. Purpose

Present rows and columns of data the person reads and compares, with the ordering,
selection, and detail they need to work through it.

## 2. Enhance, do not replace

`table`, `caption`, `thead`, `tbody`, and `th scope` already carry the structure assistive
technology navigates by — row and column relationships, header association, a name for the
whole thing. Rebuilding that out of `div` and `role` would be a downgrade, so this element
frames a native table and never rewrites it.

The same decision as Radio Group, Text Field, and Switch.

## 3. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog.

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--table-surface` | `#ffffff` | `#10131a` | Body background |
| `--table-head` | `#f4f6fa` | `#1a1e26` | Header background |
| `--table-text` | `#111827` | `#f4f6fa` | Cell text |
| `--table-muted` | `#5f6878` | `#a8afbc` | Caption and headers |
| `--table-border` | `#dfe4ec` | `#292d36` | Row rules |
| `--table-border-strong` | `#b9c2d0` | `#4a5260` | Scroll region edge |
| `--table-hover` | `#f6f8fc` | `#1b1f28` | Hovered row |
| `--table-selected` | `#eef1ff` | `#1f2740` | Selected row |
| `--table-accent` | `#4f46e5` | `#86a0ff` | Sort marker and checkboxes |
| `--table-focus` | `#6366f1` | `#86a0ff` | Focus ring |
| `--table-radius` | `12px` | | Frame radius |

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

## 4. The scroll region is a keyboard target, but only when it has to be

A box with `overflow-x: auto` cannot be scrolled by anyone without a pointer unless it can
take focus. So while the table is wider than its frame the wrapper gains `tabindex="0"`,
`role="region"`, and a name built from the caption.

The other half matters just as much: when the table fits, all three come off again. A tab
stop that leads nowhere is worse than no tab stop. A `ResizeObserver` drives both
directions, and both are measured.

Measured: at `520px` the Dense variant reports `tabindex="0"`, `role="region"`,
`aria-label="Regional performance, scrollable"`, and two arrow presses move it `80px`.

## 5. A table inside a grid or flex parent

`min-inline-size: 0` is set on the host. A grid or flex item refuses by default to shrink
below its own content, so without it a wide table pushes the whole page sideways instead of
scrolling inside its box — the scroll region exists but never scrolls.

This is set in the component rather than left to the consumer, because the consumer has no
way to see why their layout broke.

## 6. Sorting has three states

Ascending, descending, and back to the order the data arrived in. Without the third, someone
who sorted a column to check one thing can never see the original order again, so the source
position of every row is recorded before the first comparison runs.

The icon carries all three: a **pair** of triangles facing apart while the column is
unsorted, a single larger one once it is. The pair is what says the column can be sorted at
all, so it is drawn from the start rather than appearing on hover — an icon that needs a
pointer to appear tells a touch user nothing.

The marks are **filled, not stroked**. At sixteen pixels a two-pixel outline turns to mush,
and a pair of open chevrons reads as two loose marks rather than one glyph meaning
"sortable". Three things separate the sorted state from the resting one at a glance: one
mark instead of two, larger, and in the accent colour instead of muted.

Two decisions inside that:

- **`aria-sort` goes on the `th`**, never on the button inside it. The state belongs to the
  column, not to the control that changes it.
- **Blank cells sort last in both directions.** "No value" is not a small value, and a
  column reversed into a wall of empty rows tells the reader nothing. Measured: sorting the
  Region column either way leaves the blank row at the bottom.

A column is compared as numbers only when every value present parses as one. A single stray
label means comparing as text, which is wrong far less often than putting that label at an
arbitrary end.

## 7. The header checkbox has three states, and one trap

Partly selected is not "checked" and not "unchecked". That third state exists **only as a
JavaScript property**: writing `indeterminate` in the markup does nothing, which is how a
partly selected table ends up looking empty.

The trap found while building this: counting an unavailable row against the total leaves
"select all" unable to ever reach "all". Pressing it ticks every row it can, finds the count
short, and immediately draws itself half-on again. The header checkbox therefore counts only
the rows it can actually operate, while the reported selection still includes any row the
author locked in.

A second one found at review: getting that right is not enough if the row does not **look**
unavailable. Left at full strength, a row that "select all" steps over reads as a row the
header checkbox simply forgot, and the first person to see it reports a bug. Such rows are
marked `data-unavailable` and drawn in the muted colour with a dimmed, not-allowed checkbox.

## 8. Detail is a row, not a panel

An expanded row opens a real `tr` spanning the columns, so it keeps its place in the reading
order and in the table's own structure. The trigger carries `aria-expanded` and renames
itself for what it will do next.

Sorting moves a row and its detail together. A detail row separated from its parent is worse
than no detail at all.

## 9. Sticky headers need separated borders

`border-collapse: separate`. A collapsed border belongs to whichever cell scrolls away
first, so a sticky header loses its underline the moment it starts sticking.

## 10. Responsive behavior and motion

- The table keeps its structure at every width and scrolls horizontally rather than
  restacking. Row and column relationships are the point of a table; breaking them into
  cards to save width trades away what the reader came for.
- Only the expand chevron animates, at `160ms`; `prefers-reduced-motion: reduce` removes it.

## 11. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Selectable variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 12. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the table is still readable and still scrolls by pointer.
- The scroll region takes focus while it overflows and gives the tab stop back when it does
  not.
- Sorting cycles through three states and restores the source order.
- Blank cells stay last in both directions.
- The header checkbox reaches all three states, and an unavailable row does not block "all".
- An expanded row's detail keeps its place beside it after sorting.
