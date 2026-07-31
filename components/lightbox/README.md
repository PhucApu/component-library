# Lightbox

A framework-free Web Component that turns a gallery of links into a full viewer:
magnification by wheel, button or key, dragging once magnified, and a thumbnail strip that
scrolls on its own arrows.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## Markup contract

```html
<ui-lightbox>
  <ul class="lightbox__gallery">
    <li>
      <a class="lightbox__item" href="photos/harbour.jpg">
        <img src="photos/harbour-thumb.jpg" alt="Sunrise over a quiet harbour" />
      </a>
    </li>
  </ul>
</ui-lightbox>
```

- Each entry is a **link to the full picture**. Before any script runs, pressing one opens
  that picture; the component intercepts the press and shows the viewer instead. That is
  the fallback, and it costs nothing.
- **Write real `alt` text.** A viewer of pictures is worth nothing without it. The
  component reads it out with the position whenever the picture changes.
- Add `data-caption` for anything the picture cannot say itself. A caption never replaces
  an alt; they are different jobs.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `loop` | present | absent | The ends join up, so the arrows never turn off |
| `max-zoom` | number | `4` | How far in the picture will go |

## Properties, methods, events

| Member | Notes |
|---|---|
| `items` | The gallery entries |
| `open` | Whether the viewer is showing |
| `index` | Which picture, from zero |
| `scale` | Current magnification |
| `show(index)` / `close(reason)` | |
| `goTo(index)` / `step(delta)` | |
| `setZoom(scale, pointer)` / `resetZoom()` | `pointer` is measured from the frame centre |
| `labels` | Overrides every generated name |

| Event | Detail |
|---|---|
| `lightbox-open` | `{ index }` |
| `lightbox-change` | `{ index, total }` |
| `lightbox-close` | `{ reason }` — `escape`, `backdrop`, `close`, or `api` |

## Magnifying

| Way | |
|---|---|
| Wheel | Magnifies **towards the pointer**, so the detail under it stays there |
| `−` and `+` | Either side of the level, in one bordered group |
| The level field | Type a per cent and press Enter |
| `+` `-` `0` keys | |

Four ways rather than one, because scrolling alone leaves out anyone on a keyboard and
anyone on a touch screen. The range is **100% to 400%**; reset sits outside the group.

The buttons and the `+` `-` keys move in steps of 50%, so life size to the ceiling is six
presses. The wheel moves in 25% a notch. Anything further than a step or two is quicker
typed straight into the field.

A picture only holds up to 400% if it has the pixels for it. The demo pictures are vector
artwork and stay sharp at any level; a photograph will show its grain well before the
ceiling. Lower `max-zoom` for a gallery of small images.

The field settles on Enter or on leaving it, never while you are typing — clamping every
keystroke would turn the `1` of `150` into `100`.

Once magnified, drag with the pointer or use the arrow keys. The picture cannot be pulled
away from the frame, and one narrower than the frame does not move sideways at all.

## Keyboard

| Key | At rest | Magnified |
|---|---|---|
| `←` `→` | Previous / next picture | Drag sideways |
| `↑` `↓` | — | Drag up and down |
| `Home` `End` | First / last picture | First / last picture |
| `+` `-` `0` | Magnify, shrink, reset | |
| `Escape` | Close | Close |

Arrows change meaning once the picture is magnified. Magnifying is what switches the mode,
which is what makes the switch noticeable.

## The picture and its arrows

The picture takes the whole width. The arrows sit **on** it, faded at rest and full on hover
or focus — faded rather than hidden, because hover does not exist on a touch screen. Each
carries its own dark scrim so the icon holds against a bright photograph.

## The thumbnail strip

Six thumbnails stand on the strip at a time; the rest are hidden, out of the tab order as
well as out of sight.

Pressing a thumbnail changes the picture. The **arrows at each end step the picture one at a
time**, and the run on show slides along to keep up. It slides one thumbnail *before* the
current picture reaches the edge, so what is coming next is always already on the strip.

The strip has a fixed height. Hovering a thumbnail enlarges it and pushes its neighbours
aside, but the strip itself never grows — otherwise the picture above would be shoved
upwards every time the pointer crossed it.

## Folding the bottom away

The toggle is a **notch rising from the middle of the strip's top edge**, so the control
belongs to the thing it folds. Pressing it collapses the strip over about a quarter of a
second. It survives a change of picture and resets when the viewer is reopened. Navigation is
unaffected, because the arrows are on the picture rather than in the part that folds.

Folded, the section gives up **all** of its height — strip, border and tab alike — and the
picture fills the frame to the bottom edge of the panel. The tab is then drawn *over* the
picture and is invisible, so it costs the picture nothing.

Three ways bring it back:

| | |
|---|---|
| Pointer | Move near the foot of the picture — within about `96px` |
| Keyboard | Tab to it; focus reveals it |
| Touch | Press near the foot; there is no hovering on a touch screen |

While invisible it is `pointer-events: none`, so it never swallows a press meant for the
picture — dragging a magnified picture reaches the bottom edge too.

The strip folds by animating its height rather than by being removed, since nothing that has
been removed can be animated. `inert` is what takes the thumbnails out of the tab order while
they are away.

## Changing picture

A new picture slides in from the side it came from: forwards from the right, back from the
left. Pressing a thumbnail slides from whichever side that thumbnail is on.

Nothing in the viewer's chrome is selectable, because a fast second press on a control is a
double-click, and a double-click on unprotected chrome runs a selection out across the whole
panel. The caption is selectable — it is the one part worth copying.

## Without JavaScript

The gallery is a list of links to the full pictures, so it stays entirely usable. The
viewer, the magnification, and the strip are what the script adds.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, the `dialog` element with
`showModal()`, `ResizeObserver`, and `color-mix()`.

## Layout note

The host sets `min-inline-size: 0` on itself, and the panel bounds its own grid column.
Without either, a long thumbnail strip pushes the layout sideways rather than scrolling
inside the viewer.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `lightbox.html` | Runnable example |
| `lightbox.css` | Every style |
| `lightbox.js` | Rules, the custom element, and the demo bootstrap |
| `assets/` | The demo pictures, as inline SVG artwork |
