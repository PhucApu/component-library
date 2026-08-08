# Recreate Flip Book

Build a framework-free Web Component that stacks pages into a book: a leaf follows the
pointer round the spine as it turns, and arrows either side turn one leaf at a time. Plain
HTML, CSS 3D transforms and JavaScript. No framework, no build step, no external request of
any kind — the plates ship with the component.

## The central instruction

Describe the whole book with one number: how many leaves have been turned. Work out which
pages are readable, where each leaf sits in its pile, and whether an arrow has anywhere to go
from that number alone, plus the angle of the leaf currently in the air. A leaf caught half
way through a turn is then still a book with a definite state, which is what lets a drag be
released at any angle and carried on from there.

## Files

```text
flip-book-core.js   the rules, with no DOM in them
shared.js           the <ui-flip-book> element
shared.css          book, pages, arrows, demo page
demo.js             demo wiring and the theme message
assets/*.svg        the plates, drawn as flat vector scenes, portrait
variants/{default,content,drag,pace,states}/index.html
```

## Markup contract

Each child of the author's first `<ul>`/`<ol>` is one page:

```html
<ui-flip-book label="Eight plates">
  <ul><li><img src="assets/cover-tide.svg" alt="A high tide under a low sun" /></li></ul>
</ui-flip-book>
```

Move those elements into the leaves rather than copying them, so a page carrying a link or a
button keeps the element everything is already bound to. Before the script arrives the list
is a plain responsive grid; nothing is hidden behind JavaScript.

Attributes: `page` (1-based, reflected), `duration` (520ms, clamped 120–2000), `no-drag`,
`label`. Expose `page`, `pages`, `leaves`, `turned`, `next()`, `previous()`, `goTo(page)`,
and a `flip-change` event carrying `{ page, pages }`.

## Pair the pages into leaves

A leaf carries two pages, front and back, as a sheet of paper does. Eight pages are four
leaves. This is the whole reason a turn leaves a page on the left instead of swapping one
picture for another, so do not simplify it into one page per leaf.

An odd page count ends on a blank back. Dropping the last leaf would take the page in front
of it with it.

## The book opens closed

A leaf turns about its left edge, so a turned leaf lands left of the spine and the spread is
two pages wide: everything on the right at the start, everything on the left at the end.

Do not try to make it one page wide with double-sided leaves. Either the back of every leaf
is lost as it swings out of frame, or the turned pile has to be drawn somewhere it does not
belong. Below `34rem`, where there is no room for the second page, move the spine to the edge
of the stage instead and let the turning leaf sweep off the side.

## Stacking

The unturned pile is highest at the top of the book; the turned pile is highest at the end of
what has been read. Offset each leaf a little from the one below for the thickness at the
edge, and stop drawing the ones deep in the pile — there is nothing to see and something to
pay for.

Keep the two ranges of stacking order apart rather than letting them meet. A leaf in the air
sits above both, and anything it can tie with is something it can pass through.

## Drive the turn frame by frame

Use a `requestAnimationFrame` loop with an ease at both ends, and scale the duration by the
distance actually left to travel. A CSS transition cannot pick up an arc already in progress:
it restarts from whatever value the browser believed it was at, visibly, at the moment the
hand lets go. Stop asking for frames when nothing is moving.

## Two things commit a turn

Past half way, or still moving quickly on release. Distance alone throws away the short flick
that is how most people turn a page; speed alone commits a slow drag that was being
reconsidered. Take the leaf that matches the direction the hand moved, not where it landed,
and drop the click that follows a drag so dragging across a link does not follow it.

## An end is a real end

Forwards means a page the reader has not reached, not merely a leaf that could be lifted: a
book of one page has a leaf with a blank back, and turning it would show nothing. Disable the
arrow instead of letting it do nothing.

## Presentation and accessibility

Three tab stops — the book and the two arrows — with Arrow keys, Home and End. A polite
status region reports the spread once a turn has landed and says nothing during it. Shade the
leaf by the sine of its angle: strongest upright, gone at either end, and the only cue that
it has a face turned away from the light. Resolve every colour through `light-dark()` and
answer `{ type: 'ui-theme', theme }` from an embedding page.

`prefers-reduced-motion: reduce` turns without travelling; dragging still works and lands the
moment it is let go.

## Verify before calling it done

- The book opens closed, stack and edge thickness on the right.
- A drag follows the pointer, commits past half way or on a flick, and falls back otherwise.
- The arrows turn one leaf and are disabled at each end.
- Keyboard reaches everything; the status region speaks after a turn, not during it.
- A page with a link keeps it, and a drag across it does not follow it.
- Reduced motion turns without travelling.
- No horizontal overflow at 320px, and no request leaves the page.
