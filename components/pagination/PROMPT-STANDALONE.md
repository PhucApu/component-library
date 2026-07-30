# Recreate Pagination as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-pagination>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It
is self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

HTML has no pagination primitive, so this one builds its own controls rather than enhancing
something native. It also owns no data: it reports a page number, and what that means for
what is on screen is the application's decision.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
pagination.html
pagination.css
pagination.js
README.md
```

- `pagination.js` is one ES module holding the DOM-free rules, the custom element, and the
  demo bootstrap. It defines the element only when it is not already registered.
- `pagination.css` holds every style, driven by component-owned CSS custom properties.
- `pagination.html` is a runnable example showing a plain pager, the edge buttons, the
  compact arrangement, and a plain table paged by the component.
- `README.md` documents the markup contract, the attribute table, the range rules, and
  browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page
must be served over HTTP or HTTPS.

**The table in the example is plain semantic markup written right here.** Do not depend on a
separate table component: anything outside these files would be missing and the page would
arrive broken.

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

`boundary-count` pages stay at each end, `sibling-count` sit either side of the current one,
and the rest collapse.

**When a gap would hide exactly one page, show that page instead of an ellipsis.** A mark
standing in for a single number is the same width and one fewer thing anybody can reach.
Keep the arithmetic in a rule that never touches the DOM.

## The ellipsis is not a button

The hidden pages are still reachable through the neighbouring numbers and the arrows, so a
control there would add a tab stop that leads nowhere new. Mark it `aria-hidden`.

## Focus survives the list being rebuilt

Changing page rewrites the whole list, and focus is lost two different ways: the control
that was pressed may not be in the new list, and the control that carried you to an end is
now disabled — a disabled element cannot hold focus.

Remember which control had focus by key, find it again after the render, and focus it. When
it has gone or become unavailable, focus the current page instead.

## Announcements

Moving page rewrites the content elsewhere while focus stays on the button, so nothing in
the platform reports it. Announce through a `role="status"` region that is present and empty
before it is needed. Where the row range is known it is worth more than the page number.

**Clear the region when a message stops being true.** Changing the rows per page moves both
the page and the count underneath the sentence already sitting there. Empty it rather than
rewriting it: only the application knows why its own totals changed.

## Presentation and accessibility

- Name every control for where it goes — "Go to page 3", not "3" — and give the current one
  `aria-current="page"`.
- Fill the current page rather than only outlining it.
- Keep every control at least `24px` across at both scales.
- Let the list wrap rather than overflow, and offer a compact arrangement for a narrow
  column.
- There is no motion to add. A page change is a content change.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- The pages shown match the counts you set, and a gap of one page shows the page.
- Tab through the pager: the ellipsis is skipped entirely.
- Press a number, then Tab: focus is still on that number, not back at the top of the page.
- Press next until the last page: focus lands on the current page, because next is now
  unavailable.
- The accessibility inspector shows a status region that fills in on a page change.
- Change the rows per page: the old announcement is gone rather than left saying something
  untrue.
- Narrow the window: the compact arrangement still reaches every page.
