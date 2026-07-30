# Recreate Pagination

You are a Senior Frontend Engineer. Build a Web Component named `<ui-pagination>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

## The central instruction

HTML has no pagination primitive, so this one builds its own controls rather than enhancing
something native. It also owns no data: it reports a page number, and what that means for
what is on screen is the application's decision.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement
is configuration, not a separate build.

- **Default**: a list of pages at the start, in the middle, and short enough to need no
  collapsing.
- **Ranges**: the same page under four sibling and boundary counts, plus the gap that shows
  a number rather than an ellipsis.
- **Edges**: jumps to the first and last page, a numbers-only arrangement, and both ends.
- **Sizes**: the two scales beside the unavailable state.
- **Compact**: a stated position with two arrows, for a column too narrow for a row of
  numbers.
- **Table**: pagination driving a table, with rows per page and the row range it covers.

Each has to run on its own, loading nothing from another origin.

**The combined arrangement builds its own plain semantic table.** Do not reach for a
separate table component: anything outside this folder would be missing from the packaged
download, and the page would arrive broken.

## Markup contract

```html
<ui-pagination page="1" count="10">
  <nav aria-label="Search results"></nav>
</ui-pagination>
```

Render into a `nav` the author supplies and names, replacing whatever is inside it, so
server-rendered links can sit there as a no-script fallback.

## Public API

Support `page`, `count`, `page-size`, `total`, `sibling-count`, `boundary-count`, `size`
(`md` or `sm`), `compact`, `show-first`, `show-last`, `hide-prev`, `hide-next`, and
`disabled` as attributes. Expose `page`, `count`, `range`, and `labels`, plus `goTo()`.
Emit `pagination-change` with `{ page, previous, count, range }`.

Derive `count` from `total` and `page-size` when both are given, and clamp any page into
range rather than refusing it.

## Which pages are shown

`boundary-count` pages stay at each end so the first and last are always one press away, and
`sibling-count` sit either side of the current one. Everything else collapses.

**When a gap would hide exactly one page, show that page instead of an ellipsis.** A mark
standing in for a single number is the same width and one fewer thing anybody can reach.
Keep the arithmetic in a rule that never touches the DOM so every shape can be checked
without a browser.

## The ellipsis is not a button

The opposite of a collapsed breadcrumb, and for a reason. A breadcrumb's hidden levels are
reachable by no other means, so its ellipsis has to be pressable. Here the hidden pages are
still reachable through the neighbouring numbers and the arrows, so a control would add a
tab stop that leads nowhere new. Mark it `aria-hidden`.

## Focus survives the list being rebuilt

Changing page rewrites the whole list, and focus is lost two different ways: the control
that was pressed may not be in the new list, and the control that carried you to an end is
now disabled — a disabled element cannot hold focus. Either way the person is dropped to the
top of the document mid-task.

Remember which control had focus by key, find it again after the render, and focus it. When
it has gone or become unavailable, focus the current page instead.

## Announcements

Moving page rewrites the content elsewhere while focus stays on the button, so nothing in
the platform reports it. Announce through a `role="status"` region that is present and empty
before it is needed. Where the row range is known it is worth more than the page number.

**Clear the region when a message stops being true.** Changing the rows per page moves both
the page and the count underneath the sentence already sitting there. Empty it rather than
rewriting it: the component knows a page moved, but only the application knows why its own
totals changed, so announcing that belongs to the application.

## Presentation and accessibility

- Name every control for where it goes — "Go to page 3", not "3" — and give the current one
  `aria-current="page"`.
- Fill the current page rather than only outlining it, so it reads at a glance without
  depending on a border colour.
- Keep every control at least `24px` across at both scales.
- Let the list wrap rather than overflow, and offer a compact arrangement for a column too
  narrow to hold it.
- There is no motion to add. A page change is a content change; animating the buttons only
  delays reading the result.
- Define every CSS custom property the component reads inside the component itself, and
  reference nothing outside it.

## Verify before calling it done

Keep the rules that decide things — normalising a size, clamping a page, building the range,
working out which rows a page covers, composing the announcement — reachable without a
browser, so they can be tested on their own. Cover the shapes at both ends, every sibling
and boundary count, and the one-page gap.

Check these explicitly, because each is a place this component quietly goes wrong:

- The shown pages match the counts, and a gap of one page shows the page.
- The ellipsis is not focusable and is absent from the accessibility tree.
- Pressing a number leaves focus on that number; pressing an arrow leaves focus on the
  arrow; reaching an end leaves focus on the current page, not on the body.
- A page change is announced with the row range when it is known.
- Changing the rows per page clears the announcement rather than leaving a false one.
- The combined arrangement references no file outside this component.
