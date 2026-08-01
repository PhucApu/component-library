# Pagination - Design Specification

## 1. Purpose

Move between pages of a long list, and say so when the move happens.

## 2. This one builds its controls

HTML has no pagination primitive. Unlike Radio Group, Text Field, Switch, and Table, there
is nothing here to enhance, so the element renders its own list. That is the same call made
by Autocomplete, Temporal Picker, and Snackbar, and it means the control needs script the
way those do.

The author supplies a `nav` to render into rather than the buttons themselves. Anything
placed inside it — server-rendered links, for instance — is replaced once the component
runs, so a page that must work without script can ship those links as a fallback.

## 3. Pagination owns no data

It reports a page number. What that means for the rows on screen is the application's
decision, which is why the combined arrangement builds a plain semantic table right beside
it rather than reaching for the Table component: anything outside this folder would be
missing from the download and the page would arrive broken.

## 4. Visual tokens

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--pagination-text` | `#3b4657` | `#c2cad8` | Page numbers |
| `--pagination-muted` | `#5f6878` | `#7d869a` | Ellipsis and unavailable controls |
| `--pagination-border` | `#cbd5e1` | `#3b414c` | Edge button outlines |
| `--pagination-hover` | `#eef1f6` | `#232833` | Hover background |
| `--pagination-accent` | `#4f46e5` | `#4968e8` | The current page |
| `--pagination-on-accent` | `#ffffff` | `#ffffff` | The current page number |
| `--pagination-focus` | `#6366f1` | `#86a0ff` | Focus ring |
| `--pagination-size` | `2.25rem` | | Control size |

`--pagination-on-accent` does not pair. The accent stays a saturated indigo in both
themes, so white keeps its contrast on it either way.

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

## 5. Which pages are shown

`boundaryCount` pages stay at each end so the first and last are always one press away, and
`siblingCount` pages sit either side of the current one. Everything else collapses.

One detail decides whether it feels right: **when a gap holds exactly one page, that page is
shown instead of an ellipsis.** A mark standing in for a single number is the same width and
one fewer thing anybody can reach. Measured at page 7 of 9: `1 … 5 6 7 8 9`, with no
ellipsis on the right because only page 8 would have been behind it.

The arithmetic lives in a rule that never touches the DOM, so every shape can be checked
without a browser.

## 6. The ellipsis is not a button

The opposite of the decision in Breadcrumbs, and for a reason. A collapsed breadcrumb hides
levels that are reachable by no other means, so its ellipsis has to be pressable. Here the
hidden pages are still reachable through the neighbouring numbers and the previous and next
buttons, so a control would add a tab stop that leads nowhere new. It is marked
`aria-hidden`.

## 7. Every button says where it goes

"3" is not a destination. Each control is named for what pressing it does — "Go to page 3",
"Go to previous page" — and the current one is named "Page 7" and carries
`aria-current="page"`.

## 8. Focus survives the list being rebuilt

Changing page rewrites the whole list, which loses focus twice over:

- The control that was pressed may not be in the new list at all.
- The control that carried you to an end is now disabled, and a disabled element cannot
  hold focus.

Either way the person is dropped to the top of the document mid-task. So the pressed
control is remembered by key, found again after the render, and focused; when it has gone
or become unavailable, focus lands on the current page instead.

Measured: pressing `6` leaves focus on `6`; pressing `next` leaves focus on `next`; walking
to the last page leaves focus on `12`, the current page, because `next` and `last` are now
disabled.

## 9. The change is announced, and never misreported

Moving page rewrites the content elsewhere while focus stays on the button. Nothing in the
platform tells a screen reader user anything happened, so a `role="status"` region says
"Page 3 of 6, showing 11 to 15 of 26" — the row range being worth more than the page number
when it is known.

The region is also **emptied when a message stops being true**. Changing the rows per page
moves both the page and the count underneath the sentence already sitting there. It is
cleared rather than rewritten: the component knows a page moved, but only the application
knows why its own numbers changed, so announcing that belongs to the application. Found by
measuring after a rows-per-page change and reading a statement that no longer matched
anything on screen.

## 10. Narrow screens

Nine controls do not fit in a phone-width column, and wrapping them onto three lines is
worse than not showing them. `compact` states the position instead and keeps the arrows, so
every page is still reachable.

## 11. Responsive behavior and motion

- The list wraps rather than overflowing.
- Controls stay at least `24px` across at both scales.
- There is no motion. A page change is a content change, and animating the buttons would
  only delay reading the result.

## 12. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Table variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 13. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- The shown pages match the sibling and boundary counts, and a one-page gap shows the page.
- The ellipsis is not focusable and is hidden from assistive technology.
- Every control has a name that says where it goes.
- Focus is still on a usable control after the list is rebuilt, including at either end.
- A page change is announced; a message that has stopped being true is cleared.
- The combined arrangement references nothing outside this component.
