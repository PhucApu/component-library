# Drawer

A framework-free Web Component that slides a panel in from an edge. When you write a
`dialog`, the browser supplies the focus trap, Escape, the top layer, the backdrop, and the
return of focus. When you write an `aside` or a `nav`, none of that applies and the panel is
simply a panel.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## The mode comes from the element you write

| You write | You get |
|---|---|
| `<dialog class="drawer__panel">` | Modal: focus trap, Escape, top layer, backdrop, scroll lock |
| `<aside>` / `<nav>` / `<section>` | Inline: shares the edge and the slide, nothing else |

There is no `mode` attribute, so nothing can disagree with anything.

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
    <footer class="drawer__footer">…</footer>
  </dialog>
</ui-drawer>
```

- Name the panel with `aria-labelledby` pointing at its own title.
- `.drawer__body` is what scrolls; the header and footer stay put.
- Any `.drawer__close` inside closes the drawer, so a footer button can do it too.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `anchor` | `start`, `end`, `top`, `bottom` | `start` | Which edge it comes from |
| `open` | present | absent | Current state; reflects and can be set |
| `trigger` | element id | none | Button that opens it, kept in `aria-expanded` |
| `no-backdrop-close` | present | absent | Ignore backdrop presses |

## Properties, methods, events

| Member | Notes |
|---|---|
| `open` | Read and write the state |
| `modal` | Whether the panel is a dialog |
| `anchor` | Normalised anchor |
| `show()` / `close(reason)` / `toggle(force)` | |
| `labels` | Overrides the close button's name |

| Event | Detail |
|---|---|
| `drawer-open` | — |
| `drawer-close` | `{ reason }` |

`reason` is `escape`, `backdrop`, `close`, or `api`. Abandoning a panel is not the same as
finishing with it.

## Do not wire the trigger twice

A drawer with a `trigger` **already listens to that button**. Adding your own click handler
to the same button toggles it twice on one press, and the drawer looks broken. Either use
`trigger` or wire it yourself, not both.

## Scroll lock

`showModal()` puts the dialog in the top layer but leaves the page free to scroll
underneath. The component sets `overflow: hidden` on the root while a modal panel is open
and puts back whatever was there before.

## Responsive

A permanent panel and a modal one are two different things, so ship both and show one at a
time with a media query. Swapping a `nav` for a `dialog` at a breakpoint would change what
assistive technology has been told about the page halfway through someone using it. The
Responsive variant does it the honest way.

## Without JavaScript

An inline panel written `open` in the markup is there and usable — it is a `nav` with links
in it. A modal panel is not: `showModal()` is the only thing that opens a `dialog`, so a
drawer that must work without script should be inline.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, the `dialog` element with
`showModal()`, and `color-mix()`.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `drawer.html` | Runnable example |
| `drawer.css` | Every style |
| `drawer.js` | Rules, the custom element, and the demo bootstrap |
