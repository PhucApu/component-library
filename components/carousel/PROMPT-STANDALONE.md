# Recreate Carousel as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-carousel>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

This prompt targets the distributable form: three files and a folder of pictures that a
consumer drops into a project. It is self-contained and assumes no repository, build step,
manifest, or test harness.

## The central instruction

**The track is a scroll container**, not a rebuilt one. `overflow-x: auto` with
`scroll-snap-type: x mandatory` already gives swiping with momentum, trackpad gliding, snap
points, and a strip that works with scripting off. Add only what the platform lacks.

## Output

Produce exactly these, flat apart from the pictures:

```text
carousel.html
carousel.css
carousel.js
README.md
assets/
```

- `carousel.js` is one ES module holding the DOM-free rules, the custom element, and the
  demo bootstrap. It defines the element only when it is not already registered.
- `carousel.css` holds every style, driven by component-owned CSS custom properties.
- `carousel.html` is a runnable example with a plain carousel, a faded one, a two-at-a-time
  one, and one that plays on its own.
- `assets/` holds the demo pictures drawn as inline SVG artwork, a few hundred bytes each, so
  the package carries no binary payload.
- `README.md` documents the markup contract, the attribute table, the keyboard, dragging, and
  browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page
must be served over HTTP or HTTPS, while noting the strip would still scroll.

## Markup contract

```html
<ui-carousel label="Product photographs">
  <ul class="carousel__track">
    <li class="carousel__slide"><img src="assets/one.svg" alt="What the picture shows" /></li>
  </ul>
</ui-carousel>
```

Say plainly in the documentation that writing the alt text is the author's job.

## Public API

Support `effect` (`slide`/`fade`/`zoom`/`cover`), `loop`, `autoplay` in milliseconds,
`per-view`, `no-drag` and `label` as attributes. Expose `slides`, `index`, `playing` and
`labels`, plus `goTo()`, `next()`, `previous()`, `play()` and `pause()`. Emit
`carousel-change`, `carousel-play` and `carousel-pause`.

## Two things to measure first

Both decide the architecture, and neither announces itself.

- Setting `scrollLeft` on a snapping track by hand is **pulled straight back**. A pointer drag
  must switch snapping off for as long as it lasts, or the strip simply does not move.
- `tabIndex` on a scroll container is **`-1`**, with or without focusable children. Supply the
  tab stop yourself.

## Dragging

Give snapping back **after the landing**, on `scrollend`, not when the pointer lifts.
Restoring it first lets the browser snap somewhere while the drag is still being decided, so
the carousel snaps to one slide and then glides to another.

Commit on **either** distance — a fifth of a picture — **or** speed. Distance alone throws
away the short flick, which is how most people move a carousel.

Stop the click a real drag produces **on the way down**, or it reaches a link inside the
slide. Leave a press that did not travel alone. Wrap `setPointerCapture`, which throws for a
pointer id the browser does not know. Put `-webkit-user-drag: none` on the images.

## Two families of transition, one fallback

`slide` is the track scrolling. `fade`, `zoom` and `cover` need the pictures stacked, which is
a different layout. **Write the stacking from the element**, so with no script every effect
falls back to the same scrolling strip.

`cover` needs the departing picture to stay in view while the arriving one crosses over it, so
mark the outgoing slide for the length of the transition — one CSS rule cannot send the same
selector both ways at once.

## The rest

- With more than one in the frame, the last position is not the last slide: two of six leaves
  five positions and five dots.
- Read the position back off the scroll as well as writing it, and report an arrival **once**
  however it was reached.
- Autoplay ships with a pause control, stops for the pointer, for focus, for a hidden tab, and
  at the end; and never starts under `prefers-reduced-motion: reduce`.
- Keep the status region quiet while it plays.
- `aria-roledescription="carousel"` on the group and `"slide"` on each slide, with its
  position; dots as real buttons with `aria-current`, marking the position by width as well as
  colour.
- One picture: remove the controls rather than disabling them.
- An arrow that turns itself off at an end hands focus on first — a disabled element cannot
  hold focus.
- Make the non-current slides `inert` in the stacked modes only.
- Cancel the arrow keys, or two pictures go by for one key.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Turn scripting off: the strip still scrolls and snaps.
- Drag it: it moves under the pointer, and lands in one movement.
- Drag across a link and let go: the link is not followed. Click it without moving: it is.
- Press an arrow key once: one picture goes by.
- Set two in the frame: there are five dots for six pictures.
- Let the slideshow run, then hover it: it waits. Press pause: it stays stopped.
- Open a carousel holding one picture: no arrows, no dots.
