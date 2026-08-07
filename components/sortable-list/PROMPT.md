# Recreate Sortable List

You are a Senior Frontend Engineer. Build a Web Component named `<ui-sortable-list>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
drag-and-drop library, a backend, or a new dependency.

## Do not use the HTML5 drag-and-drop API

It is the obvious choice and it is the wrong one:

- `dragstart` / `dragover` / `drop` **do not fire on touch** in most mobile browsers. On a phone
  the feature is simply absent.
- A drop is only allowed after `preventDefault()` on `dragover`, which nothing about the API
  explains.
- The drag image is a browser-rendered bitmap you can barely style.
- `dataTransfer` exists to move data *between applications*, which is not what reordering is.

Use **pointer events** with `setPointerCapture`. One code path for mouse, touch and pen.

Call `setPointerCapture` inside a `try`. A pointer the browser no longer considers active throws
`NotFoundError`, and optional chaining will not save you — it guards a *missing* method, not a
*throwing* one. Letting it escape abandons the drag before it starts.

Put `touch-action: none` on the handle, or the browser claims the gesture for scrolling and your
component never sees it.

## The keyboard is the second required path

Make the handle a real `<button>`. `Space` or `Enter` picks up and puts down, the arrows move,
`Home` and `End` reach the ends, `Escape` cancels.

**`Escape` must restore the original order, not drop in place.** A cancel that quietly commits
the last position is worse than no cancel, because it teaches people not to trust it. Do the same
on `pointercancel`.

Announce every step through a `role="status"` region: the pick-up with its position, each move,
the drop, the cancel, and any refusal.

## Move the rows; then put focus back by hand

Re-insert the same nodes rather than rebuilding them, so anything living inside a row survives.

That is not enough on its own. **Re-inserting a node removes it first, and removing the focused
element blurs it** — being the same node does not save focus. Remember the active element and
restore it with `preventScroll`, or somebody reordering by keyboard is dropped onto the body
after every move.

## The arithmetic, which is where the invisible bugs are

- **A row travels the neighbour's height plus the gap, never its own.** With rows of one height
  every formula looks right; with a real table the wrong one commits a place early. Keep this
  reachable without a browser and test it against a deliberately ragged list.
- **Measure the boxes once, before anything moves.** Re-measuring mid-drag reads the transforms
  the drag applied and chases its own tail.
- **Make both paths ask the same functions**, and round-trip every index through them in a test.
  Two code paths that disagree about where a row is are two components.
- **A 5px threshold** before anything is picked up, or pressing a button inside a row registers a
  one-pixel drag and the click never lands.
- **Auto-scroll on its own frame loop** when the pointer is held near an edge. A pointer that is
  not moving sends no events, and a fifty-row list cannot otherwise be reordered past the screen.

## A locked row is a wall

Not merely a row that cannot be picked up. Rows reorder on either side of it and never across it
— treating it as only unpickable lets everything else slide underneath and changes its position
anyway, which is the opposite of what locking it meant.

**Name what refused a move**: *"In progress cannot move past Triage."* Running out of list at the
top must say nothing, because nothing stopped you there.

Mark it with a glyph rather than a fill. Check first: a tint dark enough to read against its
neighbouring row may end up darker than the page behind it, and a fill nobody can see is worse
than no fill.

## A handle by default

A row draggable everywhere cannot have its text selected or its buttons pressed. Offer whole-row
dragging as an opt-in, and even then leave a press that starts on a link, button or field alone.

## Saving

Take an async `commit` receiving `{ from, to, order }`. Show the change first, then send. Hold the
list and disable the handles while it is out; on rejection restore the previous order and say why.
Carry a token per request, or a slow failure rolls back a change the reader has since replaced.

## Tables too

Read an `<ol>`, a `<ul>`, or a `<table>` with a `<tbody>`. Two costs to design for rather than
discover:

- **Put a created handle inside the first cell.** A component cannot invent a table column: a new
  cell leaves the header one heading short and every row misaligned.
- **Use `border-collapse: separate`.** A row cannot carry a shadow while borders are collapsed,
  and the shadow is what says the row is off the page in your hand.

## Leave out

Moving rows **between two lists**. It needs two live regions, a keyboard model that crosses
lists, and a drop affordance for an empty one. Adding it here does both jobs badly.

## Verify before calling it done

Keep the drop index, the shift, the walls and the announcements runnable without a browser.

- Every variant runs in an iframe with no external request and no overflow, wide and narrow.
- **Render it and look at it.**
- With scripting off, every variant is a complete list and no handle is drawn.
- A synthetic touch drag reorders exactly as a mouse drag does.
- Nothing is picked up before the threshold.
- A short row passing a tall one commits at the tall row's midpoint, not its own.
- Tab to a handle and reach every position the pointer can; check focus afterwards.
- `Escape` restores — and prove the same keystrokes without it really would have moved the row.
- A locked row refuses, and the refusal names what stopped it.
- A refused commit restores the previous order and announces the reason.
- `prefers-reduced-motion: reduce` removes the travel and keeps the reorder.
- Re-measure every contrast floor in both themes, on exact ratios.
