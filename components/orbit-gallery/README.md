# Orbit Gallery

A ring of pictures standing in three dimensions. It drifts on its own, stops under the
pointer, and singles out whichever picture you bring round to the front — by dragging the
ring, by pressing the arrow either side of it, or from the keyboard.

## Markup contract

Write a list of pictures. The element turns it into a ring and adds nothing you have to
maintain:

```html
<link rel="stylesheet" href="orbit-gallery.css" />
<script type="module" src="orbit-gallery.js"></script>

<ui-orbit-gallery label="Landscapes">
  <ul>
    <li><img src="assets/amber-ridge.svg" alt="A ridge line under an amber sky" /></li>
    <li><img src="assets/cobalt-bay.svg" alt="A headland above a cobalt bay" /></li>
    <li><img src="assets/glass-lake.svg" alt="Mountains reflected in a still lake" /></li>
  </ul>
</ui-orbit-gallery>
```

The first `<ul>` or `<ol>` inside the element is the ring, and each of its children is one
place on it. Give every picture a real `alt`: it is what the element announces when the
ring stops.

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `speed` | `12` | Degrees per second the ring drifts. `0` stops the drift and leaves everything else. Capped at `120`. |
| `direction` | `forward` | `reverse` turns the other way. Nothing else changes. |
| `radius` | computed | Ring radius in pixels. Omit it and the element works one out from how many pictures there are and how wide they are. |
| `paused` | absent | Holds the drift. The pointer, the keyboard and dragging all still work. |
| `no-drag` | absent | Takes the drag gesture away and leaves the rest. |
| `label` | `Orbit gallery` | Accessible name for the ring. |

## Properties, methods, events

- `index` — which picture is at the front.
- `items` — the places on the ring, in order.
- `angle` — where the ring has got to, in degrees of item space.
- `pause()` — the same thing the `paused` attribute says.
- `resume()` — starts the drift again, including after a reader has taken the ring over.
- `step(delta)` — turns on by whole pictures, which is what the arrows and the arrow keys do.
- `rotateTo(index)` — turns the shortest way round to bring one picture to the front.
- `orbit-change` — fired when the picture at the front changes. `detail` carries
  `{ index, total }`. It bubbles and crosses shadow boundaries.

## Pointing, dragging, pressing

Pointing anywhere at the ring stops it where it stands rather than snapping to the nearest
place, so you can look at what is in front of you. Moving away starts the drift again from
the angle it stopped at. Pointing never singles a picture out: it is how you stop the ring,
not how you choose from it.

An arrow stands at each side of the stage and turns the ring one picture at a time. They are
ordinary buttons, so a press works with a mouse, a finger, or a keyboard, and a drag that
starts on one turns the ring instead of pressing it — the click is dropped once the press has
travelled far enough to be a drag.

Turning the ring deliberately — a drag, an arrow, a key — stops the drift and leaves the
picture where you put it. Motion that carried on regardless would take the picture you just
chose straight back off the front. `resume()` starts the drift again.

Dragging sideways turns the ring: a drag across the full width of the stage turns it half
a way round. Letting go while still moving throws it, and the throw is what the pointer was
doing in its last frames rather than the average of the whole drag, so a slow pull that ends
in a flick still flies.

When the ring runs out of movement and nothing is about to start it again, it goes the rest
of the way onto the nearest picture. That picture — the one now facing you — leaves the ring
towards you and grows while the others fade back. A ring that is still drifting settles
nothing: it would single out every picture in turn as it went past.

Dragging works with a mouse, a pen and a finger through Pointer Events. Sideways belongs to
the ring; downwards still scrolls the page.

## Keyboard

The stage takes three tab stops: the ring itself and the two arrows. The pictures on it take
none — they are not controls.

| Key | Does |
|---|---|
| <kbd>←</kbd> / <kbd>↑</kbd> | Turns back one picture |
| <kbd>→</kbd> / <kbd>↓</kbd> | Turns on one picture |
| <kbd>Home</kbd> / <kbd>End</kbd> | Brings the first or last picture to the front |

While the ring has focus it does not drift, so every step lands on a picture and that
picture is singled out exactly as a drag would leave it. A gallery that answered only the
pointer would be a gallery a keyboard cannot read.

## Accessibility

- The ring is a `group` carrying `label`, the arrows are named `Previous picture` and
  `Next picture`, and a polite status region reports the picture at the front once the ring
  has stopped. A drifting ring says nothing, because a live region
  that named every picture a turn went past would never stop talking.
- Focus is visible on the ring itself.
- The far half of the ring is turned away and taken out of the pointer's reach, so only a
  picture that can actually be seen can stop the ring.
- A picture that fails to load keeps its place on the ring and says so in words.
- `prefers-reduced-motion: reduce` removes the drift and the coasting, and the arrow keys
  arrive without travelling. Dragging still works.

## Without JavaScript

The pictures are an ordinary list, and the stylesheet leaves them as a plain responsive grid
until the element upgrades. Nothing is hidden behind the script.

## Light and dark

Every colour resolves through `light-dark()`, so the component follows the operating system
on its own. An embedding page that wants to pin one theme posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }` to the frame, which narrows `color-scheme`.
The pictures themselves do not change with the theme.

## Browser support

Needs custom elements, CSS 3D transforms with `transform-style: preserve-3d`, `:has()`,
`light-dark()` and Pointer Events: Chrome and Edge 123+, Safari 17.5+, Firefox 128+.

## Running the files

Open `orbit-gallery.html` from a local server so the module and the pictures load over HTTP.

## Files

| File | Holds |
|---|---|
| `orbit-gallery.html` | The demo page |
| `orbit-gallery.css` | Ring, tiles, states, and the demo page chrome |
| `orbit-gallery.js` | The element, its rules, and the demo wiring |
| `assets/` | The pictures the demo shows |
