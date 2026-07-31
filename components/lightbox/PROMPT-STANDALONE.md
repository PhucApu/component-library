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

Offer **four ways**: the wheel, a pair of buttons, the `+`, `-` and `0` keys, and a field the
level can be typed into. Go from life size to **four times it**, in steps of `0.5` on the
buttons and keys and `0.25` on the wheel — six presses to the ceiling rather than twenty.

Hand focus to a neighbour before turning a zoom control off. Each disables itself as a result
of being pressed, so the control going away is the one under the finger, and a disabled
element cannot hold focus: it drops to the body and every key stops working.

Put shrink, the level, and grow in **one bordered, rounded group**; reset stands outside it.
**The field must not clamp while it is being typed into** — committing every keystroke turns
the `1` of `150` into `100`. Settle on Enter or on leaving the field, and stop key events
escaping it.

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

## The picture keeps the whole width

Put the arrows **on** the picture, faded at rest and full on hover and focus. Faded rather
than hidden, because hover does not exist on a touch screen. Give each a dark scrim so the
icon holds against a white photograph, and measure that worst case at resting strength.

## The thumbnail strip

Show a **window of six** and put the rest away with `hidden`, which takes them out of the
tab order too. Pressing a thumbnail changes the picture, and so do the **arrows at each end,
one picture at a time**; the window slides along to keep up. Slide it **one place before**
the current picture reaches the edge, not after — what is coming next has to be on the strip
already, or asking for it is a leap in the dark.

Grow a thumbnail under the pointer and push its neighbours along, with width rather than a
transform. Give the strip a **fixed height, sized for the largest a thumbnail ever gets** — a
minimum height is not enough, and a strip that grows shoves the picture upwards every time
the pointer crosses it.

## Folding the bottom away

Put the toggle **on the strip, as a notch rising from the middle of its top edge**, not in
the toolbar: a control that hides something should stand on the thing it hides. Overlap the
strip's border by a pixel and drop the tab's bottom border so the two read as one surface.
If one rule styles the icons by listing the control classes, add this one to it. A path left
out falls back to `fill: black`, `stroke: none` — on a dark panel a smudge, reported nowhere.

Give it `aria-expanded` and a name for what it will do next, keep the decision across a
change of picture, and reset it when the viewer is reopened. It only works because the
arrows are on the picture.

**Fold by animating the height**, not with `hidden`: nothing that has been removed can be
animated. Use `inert` for the tab order and delay `visibility` to the end of the transition.

Folded, give up **every** pixel — the strip's border width as well as its height, and the tab
too, pulled out of the flow by a negative margin of its own height so it is drawn over the
picture while taking no room. It must then be invisible, and an invisible control needs
several ways back: the pointer near the foot of the picture, `:focus-visible` for the
keyboard, and a press for touch. Keep it `pointer-events: none` while hidden, and honour
`pointerleave` only for a mouse — a touch "leaves" the instant it lifts.
Set the state while the panel is still `display: none` when the viewer opens, where no
transition can run — unfolding in front of the picture also means measuring the frame while
it is still moving.

## Changing picture

Slide the new picture in from the side it came from. A **second element** is needed: the
slide and the magnification both want to move the picture, and one transform cannot hold two
unrelated jobs. Two steps, because a transition needs a rendered starting point — place it,
flush the layout, then send it home. Clear the inline transition rather than naming one, so
`prefers-reduced-motion` in the stylesheet is what decides whether it travels at all.

A step knows its own direction even when looping carries the index the other way; a
thumbnail has only the two positions to compare.

## Nothing in the chrome is selectable

A fast second press on a control is a double-click, and a double-click on unprotected chrome
runs a selection out across the whole panel — it looks as though the viewer has been
highlighted. `user-select: none` on the panel, `text` on the caption and the zoom field.

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
- Fade in over `180ms`, ease magnification over `120ms`, slide a new picture over `260ms`,
  fold over `280ms`, never ease while dragging. `prefers-reduced-motion: reduce` removes all
  of it, including the collapsed state's own timing.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Turn scripting off: the gallery is still links that open the full pictures.
- Scroll the wheel over the picture: it magnifies and the page stays put.
- Magnify with the wheel over a corner: that corner stays under the pointer.
- Press `Tab` a dozen times: focus never leaves the viewer. Press Escape: the focus ring is
  back on the picture you opened.
- Press reset, then press `+`: the picture magnifies. If nothing happens, focus fell to the
  body when reset turned itself off.
- Press the arrows at the ends of the strip: the picture changes one at a time and the run
  on show slides along with it, a place ahead of where you are.
- Hover a thumbnail: it grows, its neighbours move, and nothing above the strip moves at all.
- Press a control four times quickly: no part of the viewer is highlighted.
- Open a gallery holding one picture: no arrows, no strip, magnifying still works.
