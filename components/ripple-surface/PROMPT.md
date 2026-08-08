# Recreate Ripple Surface

Build a framework-free Web Component that lays still water over arbitrary content: the
pointer is a prow that pushes the water aside into two bands of crests meeting in a point at
the pointer, pressing spreads rings from the point, and at rest it draws nothing. Plain HTML, CSS and JavaScript on a Canvas 2D context. No framework,
no build step, no external request of any kind.

## The central instruction

Still is the resting state, and it must cost nothing. Draw on an empty canvas only while
ripples are alive, and stop requesting animation frames on the frame after the last one
dies. A surface that shimmered on its own would be asking for attention on every page it was
placed on, for as long as that page stayed open. Water is interesting because it is flat
until something happens to it.

## Files

```text
ripple-surface-core.js   the curves and the rules, with no DOM in them
shared.js                the <ui-ripple-surface> element
shared.css               the surface, its custom properties, the demo page
demo.js                  demo wiring and the theme message
assets/*.svg             the picture the states demo shows
variants/{default,wake,drop,tuning,states}/index.html
```

## Markup contract

The author's content goes inside; the element adds a canvas over it and nothing else:

```html
<ui-ripple-surface>
  <div class="hero"><h2>Cross the water</h2><button type="button">Still a button</button></div>
</ui-ripple-surface>
```

Attributes: `rings` (3, max 6), `spacing` (8px between samples of the path), `drop-duration`
(1400ms), `wake-duration` (900ms), `max-ripples` (90), `no-wake`, `no-drop`. Expose `count`,
`drop(x, y)` and `clear()`. Emit no events: the surface decides nothing, it presents what
the pointer is already doing.

## Over the content, and inert

Give the canvas `aria-hidden="true"` and `pointer-events: none`, and put the pointer
listeners on the host. Say both out loud or the surface becomes a lid: a heading could not
be selected, a button under it could not be pressed, and a screen reader would meet an empty
element. Pressing a button inside must both press the button and make rings.

## Rings are records; the wake is not

Give every ring the same record — place, birth, life, reach, width — and write three pure
curves over it: radius eased out (water spreads fast then slows), alpha fading across the
whole life with a short attack, width thinning as the radius grows. Draw it as a full circle.

The wake is a different kind of thing and is described in its own section below. One cap
limits both.

## The wake is one trail with two sides, not a row of marks

Keep the path the pointer has taken over the last `wake-duration` and draw two lines standing
off either side of it, growing with the distance back along the path so the shape opens out
behind the pointer.

Make every offset zero at the pointer: that is what makes the two sides meet there in a point
and open out behind it. Do not draw the point — it is where the sides arrive at the same
place.

One stroke a side is a diagram of a wake. Three things together turn it into water, and all
three are held back at the point and come in over the first stretch behind it:

- **Three strands a side**, at different distances, out of step, with different weights.
- **Two waves of different lengths** summed along each strand. One sine repeats visibly along
  a long trail and the eye reads the repeat as a pattern.
- **A fixed wobble per point of the trail**, taken from its own birth time — not chosen each
  frame, or the whole wake crawls.

Marks made independently of one another can never form that shape at all. Stamping arcs along
the path looks right in a diagram and reads on screen as a row of separate arcs.

Follow the path rather than the current heading, or the whole shape swings round every time
the reader changes direction. Hold the angle constant whatever the speed — a real wake does,
and one that swelled and collapsed with every change of pace reads as breathing. Let speed
decide the strength instead.

Fade with distance as well as with age: a pointer thrown across the surface lays a long trail
in very little time, and age alone would deliver the whole of it at full strength as an
outline round the path. Ease the offset into its limit rather than cutting it off, or both
sides show a corner on an otherwise straight run at the moment they reach it.

Sample the path every `spacing` pixels travelled, never once per pointer event: event rates
differ by browser and hardware. Fill in the run between two reports at the same spacing, or a
quick gesture is a polyline with a corner at every report. Forget the path when the pointer
leaves — keeping what was already drawn — or re-entering elsewhere draws a crossing that
never happened.

Leave touch out of the wake. A finger dragged across the surface is the page being scrolled,
and a wake for it would trail a motion nobody aimed at the surface. A tap still drops rings.

## Read the ink off the canvas, never out of the custom property

Apply `--ripple-ink` to the canvas as `color` and read `getComputedStyle(canvas).color`.
Reading the custom property looks equivalent and is not: a custom property comes back as the
tokens it was written with, so a `light-dark()` in one arrives as text the canvas cannot
paint with — and a canvas handed a colour it cannot parse silently keeps the last one, which
is black. Read it once per frame while drawing, so a theme change reaches the ripples already
spreading.

The ink carries its own alpha, and the two halves of the pair are not the same strength: a
pale line on a dark surface has less contrast to spend than a dark line on a pale one.

## The things that are easy to get wrong

- Size the canvas in device pixels and draw in CSS pixels, and re-measure on resize, or every
  ring is a staircase on a dense screen.
- Cap the live ripples. A pointer swept for a minute asks for a mark every `spacing` pixels
  the whole time.
- `prefers-reduced-motion: reduce`: make no ripples at all. Slower spreading is still
  spreading, and there is nothing else here to keep.
- The ripples never sample what is under them, so do not pretend they adapt to it. Colour is
  the page's decision.

## Presentation

Resolve every colour through `light-dark()` and answer `{ type: 'ui-theme', theme }` posted
by an embedding page by narrowing `color-scheme`. A drop reaches just under half the
diagonal of the surface, so it arrives at the edge as it fades out whatever shape the surface
is. Rings within one press follow 140ms apart, which is what makes a press read as rings
rather than one thick line.

## Verify before calling it done

- A still surface draws nothing and requests no frames.
- Crossing it leaves a band of crests either side of the path actually taken, meeting in a
  point at the pointer; pressing it sends out `rings` rings.
- A button under the surface still takes its press, and text under it can still be selected.
- Reduced motion produces nothing at all.
- `no-wake` and `no-drop` each remove one half and leave the other.
- The live count never passes `max-ripples`, and returns to zero on its own.
- No horizontal overflow at 320px, and no request leaves the page.
