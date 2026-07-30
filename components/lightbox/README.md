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
| `max-zoom` | number | `5` | How far in the picture will go |

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
| `+` `−` `⟳` buttons | In the toolbar |
| `+` `-` `0` keys | |

Three ways rather than one, because scrolling alone leaves out anyone on a keyboard and
anyone on a touch screen.

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

## The thumbnail strip

Pressing a thumbnail changes the picture. The **arrows at each end scroll the strip** —
a different job, which is why they sit at its ends rather than beside the picture. Each
turns off at its own end, and both stay off while everything fits.

When you change picture another way and the matching thumbnail has scrolled out of sight,
the strip slides just far enough to bring it back, and only then.

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
