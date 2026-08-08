# Recreate Sortable List as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-sortable-list>` using plain
HTML, CSS, and JavaScript. No React, no TypeScript, no Tailwind runtime, no drag-and-drop library,
no backend, no new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## Pointer events, not the HTML5 drag-and-drop API

That API **does not fire on touch** in most mobile browsers — on a phone the feature is simply
absent. It also needs `preventDefault()` on `dragover` before a drop is allowed, its drag image
is an unstyleable bitmap, and `dataTransfer` exists to move data between *applications*.

Use pointer events with `setPointerCapture`, called inside a `try`: an inactive pointer throws
`NotFoundError`, and optional chaining guards a missing method rather than a throwing one. Put
`touch-action: none` on the handle or the browser takes the gesture for scrolling.

## The keyboard is the second required path

The handle is a real `<button>`. `Space` or `Enter` picks up and puts down, arrows move, `Home`
and `End` reach the ends, `Escape` cancels **and restores the original order** — as does
`pointercancel`. Announce the pick-up, every move, the drop, the cancel and every refusal through
a `role="status"` region.

Move the rows rather than rebuilding them — then **put focus back by hand**. Re-inserting a node
removes it first, and removing the focused element blurs it; being the same node does not save
focus, and without a restore a keyboard user lands on the body after every move.

## Output

```text
sortable-list.html
sortable-list.css
sortable-list.js
README.md
```

The data is an ordinary `<ol>`, `<ul>`, or `<table>` with a `<tbody>`. Use `lang="en"`, and say
the page must be served over HTTP while noting the list is readable either way.

## The rules that matter

**A row travels the neighbour's height plus the gap, never its own.** With one row height every
formula looks right; with a real table the wrong one commits a place early. Measure the boxes once
before anything moves, or the drag reads its own transforms.

**Both paths use the same functions.** The keyboard target has to convert to the same travel a
pointer would have made, or the two disagree about where a row is.

**A 5px threshold**, or pressing a button inside a row registers a one-pixel drag and eats the
click. **Auto-scroll on a frame loop** near the edges, because a pointer held still sends no
events.

**A locked row is a wall**, not merely unpickable — otherwise everything else slides underneath
and its position changes anyway. Name what refused a move; say nothing when it was only the end
of the list. Mark it with a glyph, after checking whether a tint can actually clear its floor
against the row beside it.

**A handle by default.** A row draggable everywhere cannot have its text selected or its buttons
pressed.

**In a table**, put a created handle *inside the first cell* — a component cannot invent a
column — and use `border-collapse: separate`, or the lifted row cannot carry a shadow.

**Pair lists with a `group`** so they accept each other's rows. Let the list a drag starts in own
it to the end — handing over at the border leaves two lists each holding half a gesture. Paint
both: one closes the space behind the row, the other opens a slot. Find the list under the
pointer by testing each list's rectangle, never by hit-testing the document, because the dragged
row is under the pointer the whole time.

Bind `←` and `→` to cross lists **only where there is a group**, or you imply a direction that
does not exist. Make an empty list a drop target **at rest**, not one that appears when a drag
starts. **Name the destination** in every announcement. On a cancel, tidy both the list the drag
was over and the one it returns to — they are different lists. Run the **receiving** list's
commit, and on rejection send the row back across the border to the index it left.

**Leave out copying** (a row in two lists makes the order ambiguous) and **a destination that can
refuse** on capacity or type.

## Verify before delivering

- Open the network panel: nothing leaves the origin.
- **Look at it.**
- Turn scripting off: the list is all there and no handle is drawn.
- Drag with a synthetic touch pointer; it must reorder exactly as the mouse does.
- Move less than the threshold: nothing is picked up.
- Give two rows different heights and drag the short one past the tall one.
- Tab to a handle, reach every position, and check where focus ended up.
- Cancel with `Escape` — then prove the same keys without it really would have moved the row.
- Lock a row and try to cross it from both sides.
- Reject a commit and watch the list go back.
- Turn on reduced motion: the travel goes, the reorder stays.
- Re-measure every contrast floor in both themes, on exact ratios.
