# Drawer - Design Specification

## 1. Purpose

Bring a panel in from an edge: navigation, filters, or the detail of whatever is selected.

## 2. The mode comes from the element, not from an attribute

A `dialog` and an always-present navigation panel are not the same thing wearing different
clothes. One interrupts and one does not. So the author writes the element that matches, and
the component reads it:

| Author writes | Behaviour |
|---|---|
| `<dialog class="drawer__panel">` | Modal: focus trap, Escape, top layer, backdrop |
| `<aside>`, `<nav>`, `<section>` | Inline: shares the edge and the slide, nothing else |

Deriving the mode rather than declaring it twice means the two can never disagree. The same
principle as severity choosing politeness in Snackbar.

## 3. What the browser supplies

`showModal()` gives the focus trap, the Escape key, the top layer, `::backdrop`, inerting
the page behind, and returning focus to whatever opened the drawer. Writing any of that by
hand would be more code and worse.

Measured: after twelve `Tab` presses inside an open drawer, focus is still inside the panel.
After Escape, focus is back on the button that opened it.

## 4. Two things `<dialog>` does not do

**It does not hold the page still.** `showModal()` puts the dialog in the top layer and
leaves the document free to scroll underneath, so a drawer slides over a page that keeps
moving. The element sets `overflow: hidden` on the root while a modal panel is open and
restores whatever was there before. Measured: `window.scrollTo(0, 400)` leaves `scrollY` at
`0`.

**It has no backdrop element.** The backdrop is painted, not built, so a press on it arrives
with the dialog itself as the target. It is a backdrop press when the coordinates fall
outside the dialog's own box — geometry, kept in a rule that never touches the DOM so it can
be tested on its own. A keyboard activation reports a detail of zero and is never one.

## 5. Escape is intercepted, not blocked

The `cancel` event is prevented so the browser does not remove the dialog instantly and skip
the slide out; the element then closes it properly, which is what hands focus back.

Even the panel that ignores its backdrop still answers Escape. Taking away every way out
would trap someone who opened it by accident.

## 6. Every way out has a name

`drawer-close` carries a `reason`: `escape`, `backdrop`, `close`, or `api`. Abandoning a
panel is not the same as finishing with it, and nothing else in the platform tells them
apart.

## 7. One trigger, one listener

A drawer given a `trigger` attaches its own handler to that button and keeps
`aria-expanded` on it. Wiring the same button again from application code toggles twice on
one press, and the panel looks dead. Found while building the Inline variant, which did
exactly that.

## 8. Visual tokens

| Token | Light | Role |
|---|---|---|
| `--drawer-surface` | `#ffffff` | Panel background |
| `--drawer-text` | `#111827` | Panel text |
| `--drawer-muted` | `#5f6878` | Secondary text and the close button |
| `--drawer-border` | `#dfe4ec` | Header, footer, and edge rules |
| `--drawer-accent` | `#4f46e5` | Current item |
| `--drawer-backdrop` | `rgb(9 12 20 / 0.55)` | The dimmed page |
| `--drawer-size` | `20rem` | Panel width or height |

## 9. Anchors

Four edges. The horizontal pair is named `start` and `end` rather than left and right, so
they follow the writing direction. A panel never exceeds `100vw - 3rem`, so the page behind
is always visible enough to press.

## 10. Responsive without changing what the element is

A permanent panel on a wide screen and a modal one on a narrow screen are two different
things, so the Responsive variant ships both and shows one at a time. Swapping a `nav` for a
`dialog` at a breakpoint would change what assistive technology has been told about the
page, halfway through someone using it.

## 11. Motion

Slide and fade at `220ms` on a decelerating curve. The panel is revealed in two steps — one
attribute renders it at its starting offset, a layout read flushes that, and a second
attribute moves it in — because applying both in one recalculation leaves the transition
nothing to start from. The same lesson as Snackbar.

`prefers-reduced-motion: reduce` removes it, and the exit completes immediately so nothing
waits on an animation that is not running.

## 12. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 13. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- Focus cannot leave an open modal panel.
- The page behind a modal panel cannot be scrolled, and scrolls again once it closes.
- Escape closes and returns focus to the trigger.
- A press on the backdrop closes; a press inside does not.
- A panel marked `no-backdrop-close` ignores the backdrop but still answers Escape.
- An inline panel is not a dialog, takes no focus, and ignores Escape.
