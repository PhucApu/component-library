# Recreate Drawer

You are a Senior Frontend Engineer. Build a Web Component named `<ui-drawer>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

## The central instruction

A `dialog` opened with `showModal()` already supplies the focus trap, the Escape key, the
top layer, the backdrop, inerting the page behind it, and returning focus to whatever opened
it. Writing any of that by hand would be more code and worse.

**Derive the mode from the element the author wrote, never from an attribute.** A `dialog`
is modal; an `aside`, `nav`, or `section` is a plain panel that shares the edge and the
slide and nothing else. A permanent navigation panel is not a dialog, and calling it one
tells assistive technology it interrupts something when it does not.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement
is configuration, not a separate build.

- **Default**: a modal navigation panel with the focus trap and backdrop from the browser.
- **Anchor**: panels arriving from each of the four edges.
- **Inline**: a persistent panel that pushes the content beside it.
- **Responsive**: permanent on a wide screen, modal on a narrow one.
- **Scrolling**: a long panel with a fixed header and footer, over a page held still.
- **Dismissal**: every way out reported by name, beside a panel that ignores the backdrop.

Each has to run on its own, loading nothing from another origin.

## Public API

Support `anchor` (`start`, `end`, `top`, `bottom`), `open`, `trigger` (an element id), and
`no-backdrop-close` as attributes. Expose `open`, `modal`, `anchor`, and `labels`, plus
`show()`, `close(reason)`, and `toggle(force)`.

Emit `drawer-open`, and `drawer-close` with a `reason` of `escape`, `backdrop`, `close`, or
`api`. Abandoning a panel is not the same as finishing with it, and nothing else in the
platform tells them apart.

## The two things `<dialog>` does not do

**It does not hold the page still.** `showModal()` leaves the document free to scroll
underneath, so the drawer slides over a page that keeps moving. Set `overflow: hidden` on
the root while a modal panel is open, and restore exactly what was there before.

**It has no backdrop element.** The backdrop is painted, not built, so a press on it arrives
with the dialog itself as the target. Treat it as a backdrop press when the coordinates fall
outside the dialog's own box, and keep that geometry in a rule that never touches the DOM so
it can be tested on its own. A keyboard activation reports a detail of zero and is never a
backdrop press.

## Escape

Prevent the `cancel` event and close the drawer yourself. Left alone, the browser removes
the dialog instantly and the slide out never happens.

A panel that ignores its backdrop must still answer Escape. Taking away every way out traps
someone who opened it by accident.

## One trigger, one listener

A drawer given a `trigger` attaches its own handler to that button and keeps `aria-expanded`
on it. If application code also wires that button, one press toggles twice and the panel
looks dead. Say so in the documentation, and make the demo skip any button a drawer already
owns.

## Presentation and accessibility

- Name the panel with `aria-labelledby` pointing at its own heading.
- Scroll the body, not the panel: the header and footer stay put.
- Name the anchors by logical edge so they follow the writing direction, and keep a panel
  under `100vw - 3rem` so the page behind stays reachable.
- For responsive behaviour, ship both panels and show one at a time with a media query.
  Swapping a `nav` for a `dialog` at a breakpoint changes what assistive technology has been
  told about the page halfway through someone using it.
- Slide and fade at `220ms` on a decelerating curve. **Reveal in two steps**: one attribute
  renders the panel at its starting offset, a layout read flushes that, and a second
  attribute moves it in. Applied in one recalculation the transition has nothing to start
  from and the panel simply appears.
- `prefers-reduced-motion: reduce` removes the motion, and the exit completes immediately so
  nothing waits on an animation that is not running.
- Define every CSS custom property the component reads inside the component itself, and
  reference nothing outside it.

## Verify before calling it done

Keep the rules that decide things — normalising an anchor, deciding the mode from a tag
name, testing whether a point falls inside a box, classifying a backdrop press — reachable
without a browser, so they can be tested on their own.

Check these explicitly, because each is a place this component quietly goes wrong:

- Press `Tab` far more times than there are stops inside an open panel: focus never leaves
  it.
- Scroll the page while a modal panel is open: it does not move. Close it and it does.
- Escape closes the panel and focus returns to the button that opened it.
- A press on the backdrop closes it; a press inside does not.
- A panel marked `no-backdrop-close` ignores the backdrop and still answers Escape.
- An inline panel reports itself as inline, takes no focus, and ignores Escape entirely.
- Every route out reports its own reason.
