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

## 13. Out of scope, deliberately

**Moving rows between two lists.** It is a materially bigger problem — two live regions, a
keyboard model that crosses lists, a drop affordance for an empty one — and smuggling it in here
would do both jobs badly. It deserves its own decision.

## 14. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant mid-drag: one row
lifted with its accent border and shadow, the two rows it has passed shifted up into the space it
left. No animation, script, external asset, or embedded raster image.

## 15. Acceptance criteria

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
