# Recreate Light Pull

Build a framework-free Web Component that hangs a cord you can take hold of, pull to work a
switch, and set swinging. Plain HTML, CSS, SVG and JavaScript. No framework, no build step,
no external request of any kind.

## The central instruction

Simulate the cord; do not choreograph it. Make it a row of points, each remembering where it
was on the step before — that memory is its velocity. Every step: move each point by the
distance it moved last time, add gravity, then run a few passes pulling neighbouring points
back to a fixed spacing.

Everything worth having falls out of that: it curves when pulled, lags behind a hand, swings
at the rate its length gives it, and a hard pull does not look like a gentle one. A pendulum
equation gives a cord that never bends; keyframes give the same swing every time.

## Files

```text
light-pull-core.js   the simulation and the rules, with no DOM in them
shared.js            the <ui-light-pull> element
shared.css           cord, handle, demo page
demo.js              demo wiring and the theme message
variants/{default,physics,switching,sizes,states}/index.html
```

## Markup contract

The element draws everything; the page gives it a box to hang in:

```html
<div class="room"><ui-light-pull label="Room light"></ui-light-pull></div>
```

Attributes: `on` (reflected), `label`, `length` (180px, clamped 60–520). Expose `on`,
`length`, `swinging`, `toggle()`, `pull()`, and a `light-pull-change` event carrying
`{ on }`.

## Fixed steps, and a loop that stops

Run the simulation on a fixed 16ms step, up to four steps a frame, and throw away the
remainder. Verlet is not stable under a wandering timestep, and a tab hidden for a minute
must not come back and run a minute of rope in one frame. Start the loop when something
moves; stop it the frame after the cord settles. A still cord must ask for no frames.

## The handle is a real switch

Draw the cord as an SVG path with `aria-hidden`, and put a `<button role="switch">` on the
handle, moved with it each frame. A shape drawn in the cord would need a second, invented
keyboard path, and the state would be visible only to the eye. This way one control serves
pointer and keyboard, and `aria-checked` is the state.

## Taking hold, and what the cord gives

A press takes the **nearest joint within reach**, not the handle: grabbing half way up must
leave the part below hanging free. The simulation already pins whichever joint is held, so
this costs nothing.

A cord does not stretch — the switch it is fastened to travels. Let a held joint go its own
share of the cord plus its own share of that travel, and no further. **Make the travel
comfortably larger than the threshold at which the switch works**, or the cord reaches the
end of what it gives before it reaches the catch and the switch cannot be worked at all.

Work the switch on release if the pull passed the catch at any point in the drag, the way a
real one clicks as it passes the stop rather than when the hand opens. A press that never
moved is a tug at the handle.

## Decide nothing

Hold the state, reflect it, fire an event. Do not touch the page's theme, and do not reach
outside the element: a cord that wrote `color-scheme` on the document would be useless for
anything but that one job. Show the page doing the deciding in the demos instead.

## Presentation

Resolve every colour through `light-dark()` and answer `{ type: 'ui-theme', theme }` from an
embedding page. `prefers-reduced-motion: reduce` leaves the cord hanging and works the switch;
the swing is the part that goes.

Gravity, damping and the number of relaxation passes are the three numbers that decide how it
feels. Settle them by watching the cord, and say so in the design notes so the next person
does not go looking for a bug in the architecture.

## Verify before calling it done

- A cord at rest asks for no animation frames.
- Pulling past the catch and letting go works the switch; a short tug does not.
- Grabbing half way up leaves the cord below the hand free.
- After a sideways pull it swings and then stops by itself.
- The handle is a `switch` with `aria-checked`, and Space works it.
- `on` is reflected and settable from a page, and the event fires.
- Reduced motion works the switch without a swing.
- No horizontal overflow at 320px, and no request leaves the page.
