# Recreate Carousel

You are a Senior Frontend Engineer. Build a Web Component named `<ui-carousel>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

## The central instruction

**The track is a scroll container**, not a rebuilt one. `overflow-x: auto` with
`scroll-snap-type: x mandatory` already gives swiping with real momentum, trackpad gliding,
snap points, and a strip that works with scripting turned off. Rebuilding that with
`transform` means writing the physics of a touch screen by hand and getting it slightly
wrong.

```html
<ui-carousel label="Product photographs">
  <ul class="carousel__track">
    <li class="carousel__slide"><img src="…" alt="What the picture shows" /></li>
  </ul>
</ui-carousel>
```

Add only what the platform has no answer for: the arrows, the dots, the pointer drag, the
transitions that cannot be done by scrolling, and reporting where it has got to.

## Variants

Build six, each teaching one thing.

- **Default**: the track with arrows, dots, swiping and dragging.
- **Transitions**: the four effects side by side.
- **Drag**: distance, speed, a link inside a slide, and dragging turned off.
- **Peek**: more than one picture in the frame.
- **Autoplay**: playing, pausing, and every reason it stops.
- **States**: one picture, real ends, looping ends.

## Two things to measure before writing anything

Both decide the architecture, and neither announces itself.

- Set `scrollLeft` on a snapping track by hand. It is **pulled straight back to the nearest
  snap point**. So a pointer drag must switch snapping off for as long as it lasts, or it
  fights the browser for every pixel and the strip simply does not move.
- Read `tabIndex` on a scroll container, with and without focusable children. It is **`-1`**.
  Nothing puts the track in the tab order but you, and a strip that scrolls and cannot be
  reached is a strip the keyboard cannot use.

## Give snapping back after the landing, not before it

Restoring it as soon as the pointer lifts hands the scroller back to the browser while the
drag is still being decided: it snaps to whichever slide is nearest, and only then does the
carousel glide to the one it actually chose. Two movements for one gesture, with the position
wrong in between.

Restore it on `scrollend` instead, with a timer for the drag that moved nothing and so has no
scroll to end.

## Two things commit a drag, and either is enough

Travelling a fifth of a picture, **or** still moving quickly when you let go. Distance alone
throws away the short flick, which is how most people move a carousel; speed alone throws
away the slow deliberate drag most of the way across.

A press that travelled far enough is a drag, and the click it produces must be stopped **on
the way down** — a bubbling listener is already too late to keep it away from a link inside a
slide. A press that did not travel is still a press.

Wrap `setPointerCapture`: it throws for a pointer id the browser has no record of, and an
exception there leaves the drag half started, with snapping off and no listeners.

Put `-webkit-user-drag: none` on the images, or the browser's own image dragging takes the
gesture before you see it.

## Two families of transition, one fallback

`slide` is the track scrolling. `fade`, `zoom` and `cover` need the pictures **stacked** on
top of one another — a different layout, not a different parameter.

Write the stacking from the element, not the markup. Then with no script the attribute is
absent and **every** effect falls back to the same scrolling strip: one contract, one
fallback, four effects.

`cover` needs the departing picture to stay in view while the arriving one crosses over it,
and one CSS rule cannot send the same selector both ways at once. **Mark the outgoing slide**
for the length of the transition and clear it afterwards.

## Fewer positions than pictures

With more than one slide in the frame the track runs out before the slides do: showing two of
six, the sixth is on screen when the fifth is at the edge, so there are five positions and
five dots. Work the last position out rather than assuming it is the last slide.

## One arrival, one report

Four routes end in the same place — a control, the keyboard, a drag, and the scroller settling
by itself — and left alone they overlap: a press announces the change, then the scroll it
caused announces it again. Remember the last position reported and drop the repeat.

Read the position back **off the scroll** as well as writing it, because swiping and the
trackpad reach the scroller without asking you.

## Autoplay is stoppable or it does not exist

The pause control is part of the component, not an option. It must also stop while the pointer
is over it, while anything inside has focus, while the tab is in the background, and at the
last picture unless the ends join up.

Under `prefers-reduced-motion: reduce` it **never starts**. Slowing it down is answering the
wrong request.

Keep the status region quiet while it plays. A region that speaks every few seconds without
being asked is a region people turn off; announce only a change somebody made.

## Presentation and accessibility

- The carousel is a `group` with `aria-roledescription="carousel"` and a real name; each
  slide is a `group` with `aria-roledescription="slide"` and its position.
- The dots are real buttons with `aria-current`, marking the position by **width** as well as
  colour.
- Put the arrows **on** the picture, faded rather than hidden — hovering does not exist on a
  touch screen — each with its own scrim so the icon holds against any picture.
- With one picture, remove the arrows and dots rather than disabling them.
- **An arrow that turns itself off at an end must hand focus on first.** A disabled element
  cannot hold focus: it drops to the body and takes the keyboard with it.
- In the stacked modes make the slides that are not current `inert` — a tab stop underneath a
  picture is a trap. On the track leave them alone: every picture can still be scrolled to.
- Cancel the arrow keys, or the browser scrolls the track as well and two pictures go by for
  one key.
- Define every CSS custom property the component reads inside the component itself.

## Verify before calling it done

Keep the rules that decide things — the last position, the next index, the position from a
scroll offset, whether a drag commits, the autoplay interval — reachable without a browser.

Check these explicitly, because each is a place this component quietly goes wrong:

- With scripting disabled the strip still scrolls and snaps. Measure it **without running
  script in the page** — positions from the protocol, not from `evaluate`, which is the very
  thing that has been turned off.
- Snapping reads `none` during a drag and is back afterwards, and the drag lands in **one**
  movement rather than snapping and then correcting.
- Use a real pointer for drag tests. A dispatched `PointerEvent` carries no pointer id the
  browser knows, so capture fails and the drag never starts — the test then passes or fails
  for reasons that have nothing to do with what it claims to check.
- One arrow key moves one picture.
- A drag across a link does not follow it; a press that did not travel does.
- Two of six leaves five dots.
- The stacked effects mark the departing picture and make the rest `inert`.
- `carousel-change` fires once per arrival, not once per scroll event.
- An arrow that turns itself off leaves focus inside the carousel.
- Reduced motion stops autoplay starting and makes the scrolling instant.
