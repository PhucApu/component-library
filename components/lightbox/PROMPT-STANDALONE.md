# Recreate Lightbox as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-lightbox>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

This prompt targets the distributable form: three files and a folder of pictures that a
consumer drops into a project. It is self-contained and assumes no repository, build step,
manifest, or test harness.

## The central instruction

The gallery is a list of **links to the full pictures**, not buttons. Before any script
runs, pressing one opens that picture; the element intercepts the press and shows a viewer
instead. The fallback costs nothing, because it is the same file the viewer would show.

The viewer is a `dialog` opened with `showModal()`, which supplies the focus trap, Escape,
the top layer, the backdrop, and inerting the page behind it.

## Output

Produce exactly these, flat apart from the pictures:

```text
lightbox.html
lightbox.css
lightbox.js
README.md
assets/
```

- `lightbox.js` is one ES module holding the DOM-free rules, the custom element, and the
  demo bootstrap. It defines the element only when it is not already registered.
- `lightbox.css` holds every style, driven by component-owned CSS custom properties.
- `lightbox.html` is a runnable example with a grid of pictures, at least one tall and one
  wide, and at least one caption.
- `assets/` holds the demo pictures drawn as inline SVG artwork, a few hundred bytes each,
  so the package carries no binary payload.
- `README.md` documents the markup contract, the attribute table, the ways to magnify, the
  keyboard, and browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the
page must be served over HTTP or HTTPS, while noting the gallery links would still work.

## Markup contract

```html
<ui-lightbox>
  <ul class="lightbox__gallery">
    <li>
      <a class="lightbox__item" href="{full picture}" data-caption="{optional}">
        <img src="{thumbnail}" alt="{what the picture shows}" />
      </a>
    </li>
  </ul>
</ui-lightbox>
```

Take the alternative text from the gallery picture, and say plainly in the documentation
that writing it is the author's job.

## Public API

Support `loop` and `max-zoom` as attributes. Expose `items`, `open`, `index`, `scale`, and
`labels`, plus `show()`, `close(reason)`, `goTo()`, `step()`, `setZoom()`, and
`resetZoom()`. Emit `lightbox-open`, `lightbox-change`, and `lightbox-close` with a reason.

## Magnifying

Offer **three ways**: the wheel, a pair of buttons, and the `+`, `-` and `0` keys. Scrolling
alone leaves out anyone on a keyboard and anyone on a touch screen.

Register the wheel listener **non-passive** — but know why. Browsers make `wheel` passive by
default only on `window`, `document` and `body`; on an ordinary element it already is not,
so the flag is insurance for the day the handler moves rather than the thing that makes it
work.

**Magnify towards the pointer**, keeping the arithmetic in a rule that never touches the
DOM:

```text
newOffset = pointer - ((pointer - offset) / scale) * nextScale
```

Support dragging with the pointer and the arrow keys, and clamp the offset so the picture
cannot be pulled away from the frame; floor the limit at zero so a picture narrower than the
frame does not move sideways.

Arrow keys change picture at rest and drag once magnified.

## The thumbnail strip

Pressing a thumbnail changes the picture. The **arrows at each end scroll the strip** and
never change the picture. Turn each off at its own end, and both off while everything fits.

When the picture changes another way and the matching thumbnail has scrolled out of sight,
slide the strip just far enough to bring it back, and only then.

Measure the strip **after** the dialog is showing. A panel still `display: none` reports
every width as zero, so both arrows would stay off forever.

## Layout: three traps of the same shape

- Bound the panel's grid column with `minmax(0, 1fr)`, or a long strip pushes the panel past
  the viewport instead of scrolling inside it.
- Give the strip `min-inline-size: 0`, or as a flex item it grows past the panel.
- Do not size the picture with percentage maxima against a centred grid item: the height
  never resolves and the picture is clipped. Fill the frame absolutely and let
  `object-fit: contain` letterbox inside it, then work the drawn size out from the natural
  proportions for the drag limits.

## Presentation and accessibility

- Return focus explicitly to the picture that was pressed.
- Hold the page still while the viewer is open; `showModal()` does not do it.
- Announce the position and the alternative text through a `role="status"` region present
  and empty beforehand.
- Support a caption separately from the alternative text.
- With one picture, remove the arrows and the strip rather than disabling them.
- Fade in over `180ms`, ease magnification over `120ms`, never while dragging.
  `prefers-reduced-motion: reduce` removes all of it.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Turn scripting off: the gallery is still links that open the full pictures.
- Scroll the wheel over the picture: it magnifies and the page stays put.
- Magnify with the wheel over a corner: that corner stays under the pointer.
- Press `Tab` a dozen times: focus never leaves the viewer. Press Escape: the focus ring is
  back on the picture you opened.
- Press the arrows at the ends of the strip: the strip moves and the picture does not.
- Open a gallery holding one picture: no arrows, no strip, magnifying still works.
