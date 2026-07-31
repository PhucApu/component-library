# Carousel - Design Specification

## 1. Purpose

A strip of pictures that moves one at a time, by arrow, by dot, by keyboard, by swipe, and by
dragging with a pointer.

## 2. The track is a scroll container

Not a rebuilt one. `overflow-x: auto` with `scroll-snap-type: x mandatory` already gives
swiping with real momentum, trackpad gliding, snap points, and a strip that works with
scripting turned off. Rebuilding that with `transform` would mean writing the physics of a
touch screen by hand and getting it slightly wrong.

So the component adds only what the platform has no answer for: the arrows, the dots, the
pointer drag, the transitions that cannot be done by scrolling, and telling anyone listening
where it has got to.

## 3. Two measurements decided the architecture

| Measured | Result |
|---|---|
| `scrollLeft = 60` on a snapping track | Pulled straight back to `0` |
| The same with `scroll-snap-type: none` | Held at `60` |
| `tabIndex` of a scroll container, with and without focusable children | `-1` |

The first says a hand-driven drag has to switch snapping off for as long as it lasts, or it
fights the browser for every pixel and the strip refuses to move. This is the trap of the
whole component, and it does not announce itself: the drag simply does nothing.

The second says nothing puts the track in the tab order but the element. A strip that can be
scrolled and cannot be reached is a strip the keyboard cannot use.

## 4. Visual tokens

| Token | Value | Used for |
|---|---|---|
| `--carousel-surface` | `#171a20` | The frame |
| `--carousel-slide` | `#10131a` | Behind a picture while it loads |
| `--carousel-text` | `#f4f6fa` | |
| `--carousel-muted` | `#a8afbc` | A dot under the pointer |
| `--carousel-border` | `#2e3440` | The frame edge and the resting dots |
| `--carousel-accent` | `#86a0ff` | The current dot |
| `--carousel-focus` | `#86a0ff` | The focus ring |
| `--carousel-scrim` | `rgb(10 12 18 / 0.72)` | Behind an arrow and under a caption |
| `--carousel-gap`, `--carousel-radius`, `--carousel-ratio`, `--carousel-move` | | |

Measured: an arrow icon on its own scrim `19.55:1`, a caption on its scrim `19.55:1`, the
current dot against the frame `7.04:1`. The rules ask for `4.5:1` on text and `3:1` on a user
interface boundary.

## 5. Two families of transition, one fallback

`slide` is the track scrolling, and keeps the browser's swiping untouched.

`fade`, `zoom` and `cover` need the pictures stacked on top of one another rather than laid
beside one another. That is a different layout, not a different parameter, so the element
writes `data-layered` and the stylesheet stacks them.

The point of doing it that way: **the stacking only happens once the script runs**. With no
script the attribute is absent and every effect falls back to the same scrolling strip. One
markup contract, one fallback, four effects.

## 6. The picture on its way out

`cover` needs the departing picture to stay put and in view while the arriving one crosses
over it. One CSS rule cannot send the same selector both ways at once, so the element marks
the outgoing slide `data-leaving` and clears it when the movement is over.

Without it, `cover` is impossible and `zoom` is only half of itself.

## 7. Dragging

Snapping goes off at `pointerdown` and comes back **after the landing**, not before it.

Restoring it first was the first attempt and it was wrong: it hands the scroller back to the
browser while the drag is still being decided, so it snaps to whichever slide is nearest and
only then does the carousel glide to the one it actually chose. Measured — a drag of `320px`
landed on the wrong slide and corrected itself afterwards, two movements for one gesture,
with the position wrong in between. Now snapping returns on `scrollend`, with a timer for the
drag that moved nothing and so has no scroll to end.

**Two things commit a drag and either is enough**: travelling a fifth of a picture, or still
moving quickly when you let go. Distance alone throws away the short flick, which is how most
people move a carousel. Speed alone throws away the slow deliberate drag most of the way
across.

A press that travelled far enough is a drag, and the click it produces is stopped **on the
way down** — a bubbling listener is already too late to keep it away from a link inside a
slide.

`setPointerCapture` is wrapped: it throws for a pointer id the browser has no record of, and
an exception there would leave the drag half started, with snapping off and no listeners.

## 8. Fewer positions than pictures

With more than one slide in the frame the track runs out before the slides do. Showing two of
six, the sixth is already on screen when the fifth is at the edge, so there are five positions
and five dots. A control offering a sixth would scroll to somewhere the track cannot reach.

## 9. One arrival, one report

Four routes end in the same place — a control, the keyboard, a drag, and the scroller settling
by itself — and left alone they overlap: a press announces the change, then the scroll it
caused announces it again. Measured before the fix: three drags produced seven
`carousel-change` events, `[2, 2, 3, 3, 2, 2, 2]`. Now the last position reported is
remembered and a repeat is dropped: `[2, 3, 2]`.

## 10. Autoplay is stoppable or it does not exist

Content that starts moving by itself has to be stoppable, so the pause control is part of the
component rather than an option. It also stops while the pointer is over it, while anything
inside has focus, while the tab is in the background, and at the last picture unless `loop`.

Under `prefers-reduced-motion: reduce` it never starts. Slowing it down would be answering the
wrong request.

## 11. The status region speaks for a person, not a timer

Announcing every automatic change would make a region that speaks every few seconds without
being asked, which is a region people turn off. Only a change somebody made is announced.

## 12. Ends, and the trap behind them

Without `loop` the arrow at each end turns off. The control that turns itself off is very
often the one under the finger, and **a disabled element cannot hold focus** — it drops to the
body and takes the keyboard with it. Each arrow hands focus to the other before it goes.

This is the sixth time this shape has come up in the collection, after Switch's pending state,
Pagination's ends, the Lightbox's opening focus, its zoom controls, and the Accordion, where
it was avoided rather than handled.

## 13. Out of sight, out of reach — but only when stacked

In the stacked modes the slides that are not current are `inert`, because they are underneath
and a tab stop underneath a picture is a trap. On the track they are left alone: every picture
can still be scrolled to, and taking them out of reach would break the scrolling the whole
thing is built on.

## 14. Presentation

- The scrollbar is hidden. The dots, the arrows, the keyboard and the drag all say where this
  is, and a bar across the bottom of a photograph says it worse.
- The arrows sit **on** the picture, faded rather than hidden — hovering does not exist on a
  touch screen — each with its own scrim so the icon holds against any picture.
- The current dot is marked by **width** as well as colour: `22px` against `8px`.
- Images carry `-webkit-user-drag: none`, or the browser's own image dragging takes the
  gesture before the carousel sees it.

## 15. Motion

Scrolling glides; a stacked transition takes `320ms`. `prefers-reduced-motion: reduce` turns
the scrolling instant, removes the transitions, and stops autoplay from starting at all.

## 16. Responsive behaviour

Below `34rem` the arrows shrink. `per-view` is a number the consumer sets; the slides are
sized from it with `calc`, so nothing has to be recomputed on resize.

## 17. What was left out

`::scroll-marker`, `::scroll-button()` and scroll-driven animations would replace a good deal
of this script and are all supported in the browser these tests run in. They are not in every
current browser, so nothing here is built on them — but they are the direction this component
should move in.

## 18. Variants

| Variant | What it is for |
|---|---|
| Default | The track, and everything added on top of it |
| Transitions | The four effects side by side |
| Drag | Distance, speed, links inside slides, and dragging turned off |
| Peek | More than one in the frame, and fewer positions than pictures |
| Autoplay | Playing, pausing, and every reason it stops |
| States | One picture, real ends, looping ends |

## 19. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

The demo pictures are inline SVG artwork kept in `source/assets/`, a few hundred bytes each,
so the packaged download carries no binary payload.

## 20. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the strip still scrolls and snaps.
- The track carries a tab stop.
- The arrows, the dots, the keyboard and a drag all move it, and one arrow key moves one
  picture rather than two.
- Snapping is `none` during a drag and back afterwards, and the drag lands in one movement.
- A drag across a link does not follow it; a press that did not travel still does.
- Two of six leaves five dots and five positions.
- The stacked effects stop the track scrolling, mark the departing picture, and make the rest
  `inert`.
- One picture leaves no controls at all.
- An arrow that turns itself off leaves focus inside the carousel.
- Autoplay stops for the pointer, for focus, for a hidden tab, and at the end.
- `carousel-change` fires once per arrival.
- Reduced motion stops autoplay starting and makes the scrolling instant.
