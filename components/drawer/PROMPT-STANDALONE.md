# Recreate Drawer as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-drawer>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It
is self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

A `dialog` opened with `showModal()` already supplies the focus trap, the Escape key, the
top layer, the backdrop, inerting the page behind it, and returning focus to whatever opened
it. Writing any of that by hand would be more code and worse.

**Derive the mode from the element the author wrote, never from an attribute.** A `dialog`
is modal; an `aside`, `nav`, or `section` is a plain panel that shares the edge and the
slide and nothing else.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
drawer.html
drawer.css
drawer.js
README.md
```

- `drawer.js` is one ES module holding the DOM-free rules, the custom element, and the demo
  bootstrap. It defines the element only when it is not already registered.
- `drawer.css` holds every style, driven by component-owned CSS custom properties.
- `drawer.html` is a runnable example showing a modal panel from each edge, a persistent
  one, and a panel that ignores its backdrop, reporting events into an `<output>`.
- `README.md` documents the markup contract, the attribute table, the two modes, and
  browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the
page must be served over HTTP or HTTPS.

## Markup contract

```html
<button id="menu-button">Open navigation</button>

<ui-drawer anchor="start" trigger="menu-button">
  <dialog class="drawer__panel" aria-labelledby="nav-title">
    <header class="drawer__header">
      <h2 class="drawer__title" id="nav-title">Navigation</h2>
      <button type="button" class="drawer__close">…</button>
    </header>
    <div class="drawer__body">…</div>
  </dialog>
</ui-drawer>
```

Any `.drawer__close` inside the panel closes the drawer, so a footer button can do it too.

## Public API

Support `anchor` (`start`, `end`, `top`, `bottom`), `open`, `trigger` (an element id), and
`no-backdrop-close` as attributes. Expose `open`, `modal`, `anchor`, and `labels`, plus
`show()`, `close(reason)`, and `toggle(force)`.

Emit `drawer-open`, and `drawer-close` with a `reason` of `escape`, `backdrop`, `close`, or
`api`.

## The two things `<dialog>` does not do

**It does not hold the page still.** `showModal()` leaves the document free to scroll
underneath. Set `overflow: hidden` on the root while a modal panel is open, and restore
exactly what was there before.

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
- For responsive behaviour, ship both panels and show one at a time with a media query
  rather than swapping a `nav` for a `dialog` at a breakpoint.
- Slide and fade at `220ms` on a decelerating curve. **Reveal in two steps**: one attribute
  renders the panel at its starting offset, a layout read flushes that, and a second
  attribute moves it in. Applied in one recalculation the transition has nothing to start
  from and the panel simply appears.
- `prefers-reduced-motion: reduce` removes the motion, and the exit completes immediately.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Open a panel and press `Tab` a dozen times: focus never leaves it.
- Try to scroll the page while it is open: it does not move. Close it and it does.
- Escape closes it and the focus ring is back on the button you opened it with.
- Click the dimmed area: it closes. Click inside: it does not.
- The panel marked `no-backdrop-close` ignores the dimmed area and still answers Escape.
- The persistent panel takes no focus when it opens and ignores Escape entirely.
