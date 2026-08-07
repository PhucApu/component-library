# Recreate Orbit Gallery

Build a framework-free Web Component that stands pictures on a three-dimensional ring: it
drifts on its own, stops under the pointer, and singles out whichever picture is brought
round to the front by hand or by the keyboard. Plain HTML, CSS and JavaScript. No framework, no build step, no external
request of any kind — the pictures ship with the component.

## The central instruction

Describe the whole ring with one number. Call it `angle`, measure it in item space so the
picture at the front is `angle / step` where `step = 360 / count`, and rotate the DOM by the
negative of it. The drift adds to that number, a drag writes it, a throw decays into it, and
the arrow keys step it. Do not keep a separate current index: there would then be two truths
about where the ring is, and stopping it mid-turn would have to break one of them.

## Files

```text
orbit-gallery-core.js   the rules, with no DOM in them
shared.js               the <ui-orbit-gallery> element
shared.css              ring, tiles, states, demo page
demo.js                 demo wiring and the theme message
assets/*.svg            the pictures, drawn as flat vector scenes
variants/{default,density,drag,speed,states}/index.html
```

## Markup contract

The author writes a list; the element makes it a ring:

```html
<ui-orbit-gallery label="Landscapes">
  <ul>
    <li><img src="assets/amber-ridge.svg" alt="A ridge line under an amber sky" /></li>
  </ul>
</ui-orbit-gallery>
```

Before the script arrives, the list is a plain responsive grid. Nothing is hidden behind
JavaScript.

Attributes: `speed` (degrees per second, default 12, `0` stops the drift, capped at 120),
`direction` (`forward` | `reverse`), `radius` (px, computed when absent), `paused`,
`no-drag`, `label`. Expose `index`, `items`, `angle`, `pause()`, `resume()`, `step(delta)`,
`rotateTo(index)`, and an `orbit-change` event carrying `{ index, total }`.

## Work the radius out; do not state one

```text
radius = (itemWidth + gap) / 2 / tan(pi / count)
```

Take `itemWidth` from the computed width, never from a measured box: the item is already
turned in three dimensions, so its box on screen is a projection and measuring it would
shrink the ring every time it turned.

## Two writes a frame, and a loop that stops

Write the ring's rotation, and for each picture how much light it keeps. Nothing else. Let
perspective handle size — depth only takes light out, from `1` head-on to about `0.28`
edge-on, following the cosine of the angle to the front.

Use that same cosine to take the far half of the ring out of the pointer's reach. It is
hidden by `backface-visibility`, and a picture nobody can see must not be able to stop the
ring.

Request no frames while the ring is paused, hovered, focused, on a hidden tab, or drifting at
`speed="0"`. Guard the frame clock: reset it when the loop stops, never on every frame, or
every frame is handed an elapsed time of zero and the ring never moves.

## Stopping is not choosing

Pointing at a picture stops the drift at the current angle — not the nearest place — and
leaving resumes from where it stopped. That is all pointing does: it must not single a
picture out. A pointer crossing a moving ring brushes pictures nobody asked for, so the
effect would keep firing on the way past whatever the reader actually wanted.

What gets singled out — lifted out of the ring towards the viewer while the others fade — is
the picture facing the viewer with the ring at rest on it. Bringing one round to the front is
the deliberate act; hovering over one is not.

Give the keyboard the same act by a different route or the gallery is unreadable without a
pointer: a tab stop on the ring, arrow keys to turn it a picture at a time, Home and End for
the ends, no drift while it has focus. Each step lands on a picture, which is already the
condition that singles it out, so nothing extra is needed for focus. Do not make each picture
focusable — they are not controls.

## An arrow at each side, and the press that must not be a drag

Dragging is the direct way to turn the ring and the one nobody is told about, so put an
ordinary `<button>` at each side of the stage that turns it one picture. One implementation
then serves mouse, finger and keyboard.

Capture the pointer only once a press has passed the drag threshold, never on the way down:
capturing early redirects the click that follows to the stage, and the arrows never fire. Drop
the click once the press has become a drag, so dragging from an arrow turns the ring instead
of pressing it.

Put the arrows on the stage, not on the ring. On the ring they would be turned with it, dimmed
by depth, and hidden with the half that faces away. Hide them when there is one picture: there
is nowhere to step to.

## A deliberate turn stops the drift

A drag, an arrow or a key parks the ring where it lands. Drift that carried on regardless
would take the picture the reader just chose straight back off the front. Pointing does not
park it — stopping to look is not choosing — and `resume()` is how a page starts the drift
again.

## Two elements for one lift

Put the ring placement on the item and the lift and zoom on a tile inside it. One element
cannot be turned into position by the frame loop and scaled back out of it by a stylesheet
without the two fighting over the same property. It also lets the per-frame opacity sit on
the item and the hover fade on the tile, where nested opacity multiplies them for you.

## Dragging and throwing

A drag across the full width of the stage turns the ring half a way round, whatever the count.
A throw is the pointer's last 120ms, not the average of the drag: a slow pull ending in a
flick is a flick. Decay it by a constant per frame and declare it over below a threshold
rather than letting it crawl.

When the movement runs out, travel the last few degrees onto the nearest picture. Friction
almost never leaves one square to the viewer, and a reader made to land one by hand would get
the effect by luck. Only settle when the ring will stay there — under the pointer, with
focus, when `paused`, or at `speed="0"` — or a ring about to drift on again lands, singles a
picture out, and loses it: a wobble at the end of every throw. `touch-action: pan-y` gives sideways to the ring and leaves
downwards to the page. A drag that crossed a link must not follow it on release.

## Say where it is only once it has stopped

A polite status region reports the front picture — its position and its `alt` — when the ring
is not drifting or being dragged, and says nothing while it is. Naming every picture a turn
goes past is a live region that never stops talking.

## The states that are easy to forget

- One picture: radius zero, no drift, no drag, no stepping. It stands in the middle.
- A picture that fails to load keeps its place and says so in words. Check for an image that
  already failed before the element upgraded as well as listening for later failures — the
  error event fires once, and it may fire before the element exists.
- `paused` holds the drift and leaves the pointer, the keyboard and dragging alone.
- `prefers-reduced-motion: reduce`: no drift, no coasting, no transitions, arrow keys arrive
  without travelling. Dragging still works.

## Presentation and accessibility

Resolve every colour through `light-dark()` and answer `{ type: 'ui-theme', theme }` posted
by an embedding page by narrowing `color-scheme`. Do not theme the pictures. Give the ring a
visible focus ring, a `group` role and the `label`. Drift at 12 degrees a second by default;
lift and fade over 280ms.

## Verify before calling it done

- The ring drifts, stops under the pointer at the angle it had, and carries on from there.
- Pointing at a picture does not single it out.
- Dragging turns it; letting go while moving coasts, settles onto the nearest picture, and
  singles that one out while the others fade.
- The arrow either side turns it one picture, and a drag started on an arrow turns the ring
  without pressing it.
- A drag, an arrow or a key stops the drift; `resume()` starts it again.
- Tab reaches the ring and the two arrows and nothing else; arrow keys, Home and End turn it
  and single out the picture they land on.
- The status region is quiet while drifting and speaks once stopped.
- Reduced motion removes drift, coasting and transitions.
- A missing picture keeps its place and says so; one picture stands still.
- No horizontal overflow at 320px, and no request leaves the page.
