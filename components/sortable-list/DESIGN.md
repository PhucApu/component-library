# Sortable List - Design Specification

## 1. Purpose

Rows a reader can put in the order they want: a task list, a pipeline's stages, the order
pricing tiers appear on a page, a queue somebody works down. The product is an **order**, which
is why this is an input and not a data display — the reader is editing, not reading.

## 2. Not the HTML5 drag-and-drop API

The biggest decision here, and it goes against the default choice.

| The API offers | What it actually does |
|---|---|
| `dragstart` / `dragover` / `drop` | **Does not fire on touch** in most mobile browsers. On a phone the feature is simply absent |
| A drop target | Only after `preventDefault()` on `dragover`, which is a famous footgun with no explanation |
| A drag image | A browser-rendered bitmap you can barely style |
| `dataTransfer` | Built to move data **between applications**, which is not what reordering a list is |

Pointer events with `setPointerCapture` give one code path for mouse, touch and pen. `ui-carousel`
in this collection already drags this way.

`setPointerCapture` is called inside a `try` — a pointer the browser no longer considers active
throws `NotFoundError`, and optional chaining does not help because it guards a *missing* method
rather than a *throwing* one. Letting that escape abandons the drag before it starts. Without
capture the drag still works; it just gives up more easily.

## 3. The keyboard is the second required path

This is the half nearly every drag-and-drop library skips, and the reason so many admin screens
cannot be operated without a mouse. The handle is a real `<button>`.

| Key | Does |
|---|---|
| `Space` / `Enter` | Picks the row up, and puts it down |
| `↑` `↓` | Moves it one place |
| `Home` `End` | To the ends of what it is allowed to reach |
| `Escape` | Cancels **and puts the row back where it started** |

`Escape` restores rather than dropping in place. A cancel that quietly commits the last position
is worse than no cancel, because it teaches people not to trust it. `pointercancel` — a phone
call, a system gesture — does the same thing.

Every step goes through a `role="status"` region: the pick-up with its position, each move, the
drop, the cancel, and any refusal.

## 4. Rows are moved, not re-rendered — and that is not enough on its own

The same nodes are re-inserted in the new order, so anything living inside a row survives.

But **re-inserting a node removes it first, and removing the focused element blurs it.** Being
the same node does not save focus. Without an explicit restore, somebody reordering by keyboard
is dropped onto the body after every single move — the exact failure the keyboard path exists to
prevent. `_applyOrder` remembers the active element and gives focus back with `preventScroll`.

## 5. The arithmetic, which is where the invisible bugs live

**A row travels the *neighbour's* height plus the gap, never its own.** With rows of one height
every formula looks right. With a real table they differ, and the wrong one commits a place early
— measured in the Table variant, a 47px row passing a 59px row swaps at `30px`, not at `23px`.

**Boxes are measured once, before anything moves.** Re-measuring mid-drag reads the transforms
the drag itself applied and chases its own tail.

**Both paths ask the same functions.** `offsetTo` converts a keyboard target into the same travel
a pointer would have made, and a unit test round-trips every index through `dropIndex` to prove
the two agree. Two code paths that disagree about where a row is are two components.

**A 5px threshold** before anything is picked up. Without it, pressing a button inside a row
registers a one-pixel drag and the click never lands.

## 6. A locked row is a wall

Not merely a row that cannot be picked up. Rows reorder freely on either side of a locked row
and never across it, which is what "this one stays first" actually means — treating it as only
unpickable lets everything else slide underneath and changes its position anyway.

A refused move **names what stopped it**: *"In progress cannot move past Triage."* Running out of
list at the very top says nothing, because nothing stopped you there.

**Marked with a lock glyph, not a colour.** In dark mode no tint cleared `1.15` against its
neighbouring row without going darker than the page behind it, and a fill nobody can see is worse
than no fill. The lock sits where the handle would be, so the row is marked positively rather
than by something being absent.

## 7. Saving, and taking it back

A reorder has to feel instant, so the row lands where it was dropped and the request goes out
afterwards. That is a promise the component then has to keep.

`commit` takes an async function and receives `{ from, to, order }`. It is deliberately the shape
`ui-switch` already uses here, because it is the same problem. While it is out the list holds at
reduced opacity and the handles are disabled; on rejection the previous order is restored and the
reason announced.

Each request carries a token. Without one a slow failure could roll back a change the reader has
since replaced, and the list would jump to an order nobody chose.

## 8. A handle by default, the whole row on request

A row draggable everywhere cannot have its text selected or its buttons pressed. `drag="row"` is
the opt-in, and even then a press that starts on a link, button or field is left alone.

`touch-action: none` on the handle, or the browser claims the gesture for scrolling and the
component never sees it.

## 9. Table rows, which are the rows most people mean

The only difference inside the component is where it looks for the container. Two costs are worth
stating rather than discovering:

- **The handle goes inside the first cell.** A component cannot invent a table column: a new
  `<td>` would leave the header one heading short and every row misaligned from it.
- **Borders have to be separate.** A row cannot carry a shadow while the table collapses its
  borders, and the shadow is what says the row is off the page in your hand.

## 10. Colour, measured

Against this component's own two surfaces, on exact ratios rather than rounded ones:

| | Floor | Light | Dark |
|---|---|---|---|
| Row text vs row | `4.5` | `17.7397` | `15.0855` |
| Muted text vs row | `4.5` | `5.6181` | `7.4017` |
| Handle icon vs row | `3.0` | `3.7700` | `4.7480` |
| Grabbed row vs its neighbour | `1.2` | `1.2613` | `1.2850` |
| Grabbed outline on it | `3.0` | `3.5007` | `3.4905` |
| Lock glyph vs row | `3.0` | `5.6181` | `7.4017` |
| Row edge vs surface | `1.2` | `1.2850` | `1.4636` |

## 11. Variants

| Variant | Teaches |
|---|---|
| Default | Handle dragging, the threshold, and the pointer path that also works on touch |
| Table | Real table rows, the two costs, and ragged row heights |
| Connected | Moving rows between grouped lists, by pointer and by keyboard |
| Keyboard | The second path in full, and the cancel that restores |
| Commit | Saving, holding, and going back when the server refuses |
| Markup | The data contract, the no-script fallback, auto-scroll inside a box |
| States | Locked walls, one row, nothing, switched off, a failure |

## 12. Tokens

| Token | Role |
|---|---|
| `--sortable-row`, `--sortable-surface` | The row and the page behind it |
| `--sortable-ink`, `--sortable-ink-muted` | Words |
| `--sortable-handle`, `--sortable-handle-hover` | The grip |
| `--sortable-accent`, `--sortable-grabbed` | The row in the air |
| `--sortable-border`, `--sortable-focus` | |
| `--sortable-radius`, `--sortable-gap`, `--sortable-motion` | |

## 13. Moving rows between lists

Held back from the first version on purpose, and added in `0.2.0` once it could be decided on
its own terms. Lists sharing a `group` accept each other's rows.

**The list a drag starts in owns it from beginning to end.** Handing ownership over at the
border would leave two lists each holding half a gesture, and a cancel that has to find its way
home through both. The source tracks which list it is currently over and what index it would
land at; nothing moves until the drop.

That means `_paint` drives **two** lists at once: the one losing a row closes the space behind
it, and the one gaining a row opens a slot.

### The keyboard, which was the reason to hold it back

`←` and `→` cross lists; `↑` and `↓` then move within whichever list the row is over.

**They are bound only on a list that has a group.** On a list of its own they stay unclaimed —
binding them would imply a direction that does not exist and send a keyboard user looking for
it. Running out of lists says so rather than going quiet.

The index carries across: a row taken from third place arrives at third place, clamped to what
the destination can hold. Landing everything at the top would make crossing two lists a way of
losing your place.

### An empty list has no gap to aim at

Its empty message doubles as the drop target — and it is **present at rest**, not conjured when
a drag begins. A zone that appears under the pointer shoves the rest of the board aside at the
exact moment somebody is aiming at it.

### The announcement names the list

A cross-list move that says only "position 2 of 4" has left out the only thing that changed.
Each list is named by `name`, falling back to `aria-label`.

### Listeners belong to the list, not to the handle

Found by use, after the tests said it was fine.

A handle carries its listeners with it when its row moves. Bound per handle, the list a row
**left** goes on answering for it: it looks the row up in its own rows, finds no index, and
gives up. The handle looks alive and is dead — a row could be moved across once and then never
again.

Both `pointerdown` and `keydown` are delegated from the list element itself, so whichever list
holds the row is the one that hears the press. It also means a press only starts a drag when it
lands on a handle — or anywhere on the row under `drag="row"`, minus anything you can operate.

The test that missed it transferred a row and stopped there. **Picking the same row up a second
time is the only thing that shows it**, and that is what the regression test now does.

### A cancel has two lists to tidy

The destination on a cancel is *home*, which is a different list from the one the drag was over.
Clearing only the destination leaves the hovered list still outlined as a target for a move that
never happened — found by measurement, and now locked by a test.

### Undoing a transfer is not undoing a reorder

The receiving list's `commit` runs: it is the one making a claim about new state. On rejection
the row goes back **across the border, to the index it left** — restoring this list's own order
would leave the row here, which is the thing being refused.

A locked row is a wall inside its list and does not emigrate from it either.

## 14. Still out of scope

**Copying rather than moving.** A row that exists in two lists makes `order` ambiguous.

**A destination that can refuse.** Capacity limits and type rules are the page's business for
now; same group accepts, and a `disabled` or `pending` list does not.

## 15. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant mid-drag: one row
lifted with its accent border and shadow, the two rows it has passed shifted up into the space it
left. No animation, script, external asset, or embedded raster image.

## 16. Acceptance criteria

- All six variants run independently in an iframe with **no external request** and no overflow,
  at 960 and 360.
- With scripting disabled every variant is a complete, readable list; no handle is rendered.
- A mouse drag and a touch drag produce the same reorder.
- Nothing is picked up before the pointer clears `5px`.
- A short row passing a tall one commits at the tall row's midpoint, not its own.
- The keyboard reaches every position a pointer can, and focus stays on the handle that moved.
- `Escape` restores the original order; the same keystrokes without it really do reorder.
- A locked row cannot move and cannot be moved past; the refusal names it.
- `commit` holds the list while in flight, keeps an accepted order, and restores a refused one.
- `disabled` disables the handles rather than swallowing events.
- `prefers-reduced-motion: reduce` removes the travel and keeps the reorder.
- Every contrast floor in section 10 is met in both themes.
- A pointer drag and a keyboard walk both move a row into another list in the group.
- `←` and `→` are unclaimed on a list with no group; running out of lists says so.
- An empty list is a drop target, and it is one before any drag begins.
- A cancel over another list leaves no mark on it and restores every order.
- A locked row does not leave its list.
- A refused transfer returns the row across the border to the index it left.
- A row that has already moved lists can be picked up and moved again, and the list that
  received it still reorders on its own.
