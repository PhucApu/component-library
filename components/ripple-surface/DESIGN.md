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

## 4. One record, two shapes

Every ripple is the same record — where, when, how long, how far, how wide — and the three
curves in the core are the whole of how one looks at any moment. A drop is that record drawn
as a full circle; a wake mark is the same record drawn as an arc. Nothing else about them
differs, which is why one loop draws both and one cap limits both.

- **Radius** eases out. Water spreads quickly and then slows; a ring that grew evenly reads
  as a shape being scaled rather than as water.
- **Alpha** fades over the whole life, with a short attack so nothing appears at full
  strength on the frame it is born.
- **Width** thins as the ring widens, the way a spreading wave loses height.

## 5. The wake is made by distance, not by events

A mark is emitted when the pointer has travelled `spacing` pixels, never once per move
event. Pointer events arrive at whatever rate the browser and the hardware feel like, so
emitting per event would make the same gesture look different on different machines, and a
high-rate pointer would fill the cap in a second.

Each mark is an arc facing the way the pointer came from, because a wake is what the water
does after something has gone past. It opens wider the faster the pointer was moving, so a
crawl leaves a narrow line and a dash leaves a spreading V.

Leaving the surface forgets the last point. Without that, re-entering somewhere else would
draw a mark for a crossing that never happened.

## 6. Touch is left out of the wake on purpose

A tap drops rings. A finger dragged across the surface does not leave a wake, because on a
touch screen that gesture is the page being scrolled: a surface that answered it would be
drawing a wake for a motion the reader never aimed at it, and the marks would trail the
finger while the page slid the other way.

## 7. The cap is the only thing between a sweep and a stall

A pointer swept across the surface asks for a mark every `spacing` pixels for as long as it
moves. `max-ripples` keeps the newest and drops the rest, so the frame cost has a ceiling
that does not depend on how long anyone plays with it.

## 8. The ink is read off the canvas, not out of the token

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

## 9. Colour, and what the surface cannot know

The ripples are drawn over whatever is underneath and never sample it. Sampling would mean
reading pixels back every frame — expensive, and still wrong wherever a ring crosses from a
light area to a dark one.

So the ink is the page's decision, and it carries its own alpha: a pale line on a dark
surface has less contrast to spend than a dark line on a pale one, which is why the two
halves of the default pair are not the same strength. `--ripple-strength` is the single knob
for turning the whole surface down on a busy background.

## 10. Visual tokens

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

## 11. Motion

A ring from a press lives 1400ms and a wake mark 700ms by default; both are clamped so a
ripple cannot outlive the visit that made it. Rings within one press follow each other out
140ms apart, which is what makes a press read as rings rather than as one thick line.

`prefers-reduced-motion: reduce` makes no ripples at all. Slower spreading is still
spreading, and there is nothing else here to keep.

## 12. Responsive behaviour

The canvas is sized in device pixels and drawn in CSS pixels, so a ring is a ring rather
than a staircase on a dense screen, and it is re-measured whenever the box changes. A drop
reaches just under half the diagonal, so it arrives at the edge as it disappears whatever
shape the surface is.

## 13. Variants

| Variant | Shows |
|---|---|
| `default` | Wake and rings over a hero whose button still takes its own presses |
| `wake` | The trail alone, and what `spacing` does to it |
| `drop` | The rings alone, from a press, a tap, and `drop()` |
| `tuning` | Life, strength, and the ripple cap |
| `states` | Over a picture, over selectable words with a working link, and reduced motion |

## 14. Distribution preview

The packaged demo is the `default` variant: it is the only one that shows the wake, the
rings, and the content underneath staying live, all in one surface.

## 15. Acceptance criteria

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
