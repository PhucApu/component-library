# Ripple Surface - Design Specification

## 1. Purpose

A surface that behaves like still water: crossing it leaves a wake, pressing it sends rings
out from the point. The deliverable is the motion — take the ripples away and there is
nothing left but the content that was already there — which is why this is an animation
rather than a container.

## 2. Still is the resting state, and it costs nothing

At rest the canvas is empty and no animation frame is requested. The loop starts when a
ripple is born and stops on the frame after the last one dies.

This is a design decision, not an optimisation. A surface that shimmered on its own would
be asking for attention it has no reason to want, and it would be doing so on every page it
was placed on for as long as that page was open. Water is interesting because it is flat
until something happens to it.

## 3. Drawn over the content, and inert

The canvas covers the element and carries `aria-hidden` and `pointer-events: none`. Both
have to be said out loud or the surface stops being something the page is seen through and
becomes a lid on it: a heading could not be selected, a button under it could not be
pressed, and a screen reader would meet an element with nothing in it.

The pointer listeners sit on the host rather than the canvas, so events that pass through
the canvas to the content still reach the surface on their way up. Pressing a button inside
therefore makes rings and presses the button.

## 4. A press is a set of things; a crossing is one thing

A press makes rings, and each ring is complete in itself: where, when, how long, how far, how
wide, drawn as a circle. Three pure curves are the whole of how one looks at any moment.

- **Radius** eases out. Water spreads quickly and then slows; a ring that grew evenly reads
  as a shape being scaled rather than as water.
- **Alpha** fades over the whole life, with a short attack so nothing appears at full
  strength on the frame it is born.
- **Width** thins as the ring widens, the way a spreading wave loses height.

A crossing is not like that, and the first build of this component got it wrong by treating
it as if it were. Marks made independently of one another can never meet in a point, and a
point is the whole shape of a wake — so what looked like a wake in a diagram read on screen
as a row of separate arcs being stamped along the path.

## 5. The wake is one trail with two sides

The element keeps the path the pointer has taken over the last `wake-duration` and draws
strands standing off either side of it. Every offset is zero at the pointer, which is why the
two sides meet there in a point, and grows with the distance back along the path, which is why
the shape opens out behind it. The point of the wake is therefore not drawn: it is where the
sides arrive at the same place.

Because the offset follows the path rather than the current heading, turning a corner leaves
a wake along the route actually taken. A V drawn behind the current direction would swing the
whole shape round on every change of heading, which reads as sliding rather than as water.

The angle is a constant, and deliberately not a function of speed: a real wake holds the same
angle however fast the hull is going, and a V that swelled and collapsed with every change of
pace would read as the shape breathing. Speed decides how strongly the wake draws.

### What stops it looking like two lines

A single stroke a side is a diagram of a wake. Water disturbed by something passing through it
is a band of crests at slightly different distances, out of step with one another, and three
things together are what turn the one into the other:

- **Three strands a side** rather than one, at different distances, with different phases and
  weights. Three is the fewest that reads as a band rather than as a line with an outline.
- **Two waves of different lengths** summed along each strand rather than one. A single sine
  repeats visibly along a long trail and the eye reads the repeat as a pattern; two that do
  not divide into one another never quite come round to the same shape.
- **A fixed wobble per point of the trail**, taken from its own birth time. Waves alone are
  smooth, and smooth is what makes a line look drawn. It has to be fixed rather than chosen
  each frame: noise redrawn every frame makes the whole wake crawl.

All three are held back at the point, where the two sides have to meet cleanly, and come in
over the first stretch behind it.

Two more details keep the shape itself honest:

- **It fades with distance as well as with age.** A pointer thrown across the surface lays a
  very long trail in very little time, and every point of it is still young, so age alone
  would deliver the whole shape at full strength — an outline around the path.
- **The offset eases into its limit** rather than being cut off at it. A hard limit puts a
  visible corner in both sides of an otherwise straight run, at the moment they reach it.

## 6. The path is sampled by distance, and gaps are filled

The trail takes a sample every `spacing` pixels travelled, never once per move event. Pointer
events arrive at whatever rate the browser and the hardware feel like, so sampling per event
would make the same gesture look different on different machines.

A quick gesture is reported in long jumps, so the run between two reports is walked at the
same spacing and filled in. Without that, a fast pass is a polyline with a corner at every
report, which is exactly what a wake must not look like.

Leaving the surface forgets the path but keeps what was drawn: the trail already made fades
where it is, and only the prow goes with the pointer. Without forgetting the path,
re-entering somewhere else would draw a crossing that never happened.

## 7. Touch is left out of the wake on purpose

A tap drops rings. A finger dragged across the surface does not leave a wake, because on a
touch screen that gesture is the page being scrolled: a surface that answered it would be
drawing a wake for a motion the reader never aimed at it, and the marks would trail the
finger while the page slid the other way.

## 8. The cap is the only thing between a sweep and a stall

A pointer swept across the surface asks for a mark every `spacing` pixels for as long as it
moves. `max-ripples` keeps the newest and drops the rest, so the frame cost has a ceiling
that does not depend on how long anyone plays with it.

## 9. The ink is read off the canvas, not out of the token

`--ripple-ink` is applied to the canvas as `color`, and the drawing reads
`getComputedStyle(canvas).color`.

Reading the custom property directly looks equivalent and is not. A custom property is
handed back as the tokens it was written with, so a `light-dark()` inside one arrives at the
canvas as text rather than a colour — and a canvas given a colour it cannot parse does not
complain: it keeps the last one it had, which is black. The first build of this component
drew black rings in both themes for exactly that reason, and it looked plausible enough in
the light theme to be missed.

Reading it once per frame, and only while there is something to draw, is what lets a theme
change reach the ripples already spreading rather than only the next one.

## 10. Colour, and what the surface cannot know

The ripples are drawn over whatever is underneath and never sample it. Sampling would mean
reading pixels back every frame — expensive, and still wrong wherever a ring crosses from a
light area to a dark one.

So the ink is the page's decision, and it carries its own alpha: a pale line on a dark
surface has less contrast to spend than a dark line on a pale one, which is why the two
halves of the default pair are not the same strength. `--ripple-strength` is the single knob
for turning the whole surface down on a busy background.

## 11. Visual tokens

| Token | Role |
|---|---|
| `--ripple-ink` | Colour and transparency of every ripple |
| `--ripple-strength` | One multiplier over the whole surface |
| `--ripple-drop-width` / `--ripple-wake-width` | Starting line widths |
| `--ripple-still` | The demo pool's resting surface |
| `--ripple-text` / `--ripple-muted` / `--ripple-border` | Demo content |

### Choosing a theme

Every pair resolves through `light-dark()`, so the component follows the operating system
without a script. An embedding page posts `{ type: 'ui-theme', theme }` and the demo narrows
`color-scheme` to that keyword. The message carries no token and no stylesheet, so answering
it adds no dependency on the host.

## 12. Motion

A ring from a press lives 1400ms and a wake mark 700ms by default; both are clamped so a
ripple cannot outlive the visit that made it. Rings within one press follow each other out
140ms apart, which is what makes a press read as rings rather than as one thick line.

`prefers-reduced-motion: reduce` makes no ripples at all. Slower spreading is still
spreading, and there is nothing else here to keep.

## 13. Responsive behaviour

The canvas is sized in device pixels and drawn in CSS pixels, so a ring is a ring rather
than a staircase on a dense screen, and it is re-measured whenever the box changes. A drop
reaches just under half the diagonal, so it arrives at the edge as it disappears whatever
shape the surface is.

## 14. Variants

| Variant | Shows |
|---|---|
| `default` | Wake and rings over a hero whose button still takes its own presses |
| `wake` | The trail alone, and what `spacing` does to it |
| `drop` | The rings alone, from a press, a tap, and `drop()` |
| `tuning` | Life, strength, and the ripple cap |
| `states` | Over a picture, over selectable words with a working link, and reduced motion |

## 15. Distribution preview

The packaged demo is the `default` variant: it is the only one that shows the wake, the
rings, and the content underneath staying live, all in one surface.

## 16. Acceptance criteria

- A still surface draws nothing and requests no frames.
- Moving across it leaves a wake that opens behind the pointer and fades.
- Pressing it sends `rings` rings out from the press and they disappear.
- A button under the surface still receives its press; text under it can still be selected.
- The canvas is `aria-hidden` and takes no pointer events.
- Reduced motion produces no ripples at all.
- `no-wake` and `no-drop` each remove one half and leave the other.
- Ripples never outnumber `max-ripples`.
- The canvas follows the box on resize, in device pixels.
- No horizontal page overflow from 320px, and no external requests.
