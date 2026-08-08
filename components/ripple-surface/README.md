# Ripple Surface

Still water laid over whatever you put inside it. The pointer is a prow: moving it pushes the
water aside into two bands of crests that meet in a point at the pointer and open out behind
it. Pressing spreads rings from the point, the way something dropped in water does. At rest
it draws nothing and asks for no animation frames.

## Markup contract

Put your content inside the element. It adds a canvas over the top and nothing else:

```html
<link rel="stylesheet" href="ripple-surface.css" />
<script type="module" src="ripple-surface.js"></script>

<ui-ripple-surface>
  <div class="hero">
    <h2>Cross the water</h2>
    <button type="button">Still a button</button>
  </div>
</ui-ripple-surface>
```

The element gives itself `position: relative`; the canvas covers it and takes no pointer
events, so text inside stays selectable and controls stay pressable. Give the element or its
content a height — an empty surface has nothing to be still about.

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `rings` | `3` | How many rings one press sends out, up to `6`. |
| `spacing` | `8` | Pixels of path between one sample of the trail and the next. |
| `drop-duration` | `1400` | How long a ring from a press lives, in milliseconds. |
| `wake-duration` | `900` | How long a point of the trail lives, in milliseconds. |
| `max-ripples` | `90` | The most marks that may be alive at once — rings and trail points alike; the oldest go first. |
| `no-wake` | absent | No trail behind the pointer. Presses still make rings. |
| `no-drop` | absent | No rings from a press. The trail still follows the pointer. |

## Properties, methods, events

- `count` — how much is still moving: rings alive, plus points in the trail.
- `drop(x, y)` — sends rings out from a point, measured from the top left of the surface.
- `clear()` — takes everything off the surface and lets it go still.

There is no event. The surface reports nothing because it decides nothing: it is a
presentation of what the pointer is already doing.

## Custom properties

| Property | Does |
|---|---|
| `--ripple-ink` | The colour, alpha included, the ripples are drawn in |
| `--ripple-strength` | A multiplier over the whole surface, for turning it down on a busy background |
| `--ripple-drop-width` | Starting line width of a ring from a press |
| `--ripple-wake-width` | Starting line width of a wake mark |

The ripples are drawn over whatever is underneath and never sample it, so a pale ink
disappears against a pale picture. Choose the ink for the background you are putting the
surface on; the `states` variant shows one over a photograph.

## The wake

The element keeps the path the pointer has taken over the last `wake-duration` and draws
strands standing off either side of it. Every offset is zero at the pointer — which is why
the two sides meet there in a point — and grows the further back along the path they go, so
the shape opens out behind the pointer at a fixed angle. Turn a corner and the wake follows
the path you took rather than swinging round to your new heading.

Each side is three strands at slightly different distances and out of step with one another,
two waves of different lengths run along each of them, and every point of the trail carries a
small fixed wobble taken from its own birth time. One clean stroke a side is a diagram of a
wake; the band that this adds up to is what reads as a surface being disturbed.

The angle is deliberately constant: a real wake holds its angle however fast the hull is
going. Speed decides how strongly the wake draws, not what shape it is.

The path is sampled by distance travelled, never once per pointer event, and long jumps
between reports are filled in, so a fast gesture is a curve rather than a run of corners.

## Pointer, touch, keyboard

Moving a mouse or a pen leaves a wake. A tap sends rings out from where it landed. Dragging
a finger does **not** leave a wake: on a touch screen that gesture is the page being
scrolled, and a surface that answered it would be fighting what it is drawn on top of.

Nothing here is focusable and nothing here is announced. The surface is decoration over
content that keeps its own semantics, so there is no keyboard behaviour to learn and nothing
for a screen reader to read: the canvas is `aria-hidden`.

## Reduced motion

Under `prefers-reduced-motion: reduce` the surface makes no ripples at all — not slower
ones, none. Spreading rings are the whole of what it does, and a slower spread is still a
spread. What is left is a still surface, which is what it looks like at rest anyway.

## Cost

Frames are requested only while something is moving on the surface, and the loop stops as
soon as the last ripple dies. A page with several still surfaces on it runs no animation at
all.

## Light and dark

Every colour resolves through `light-dark()`, so the component follows the operating system
on its own. An embedding page that wants to pin one theme posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }` to the frame, which narrows `color-scheme`.

## Browser support

Needs custom elements, Canvas 2D, Pointer Events, `ResizeObserver` and `light-dark()`:
Chrome and Edge 123+, Safari 17.5+, Firefox 128+.

## Running the files

Open `ripple-surface.html` from a local server so the module and the picture load over HTTP.

## Files

| File | Holds |
|---|---|
| `ripple-surface.html` | The demo page |
| `ripple-surface.css` | The surface, its custom properties, and the demo page chrome |
| `ripple-surface.js` | The element, its rules, and the demo wiring |
| `assets/` | The picture the states demo shows |
