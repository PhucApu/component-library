# Carousel

A framework-free Web Component built on a scroll-snapping track: swiping, momentum and
keyboard scrolling come from the browser, and the arrows, dots, pointer dragging and four
transitions are added on top.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## Markup contract

```html
<ui-carousel label="Product photographs">
  <ul class="carousel__track">
    <li class="carousel__slide">
      <img src="photos/one.jpg" alt="What the picture shows" />
    </li>
    <li class="carousel__slide">
      <img src="photos/two.jpg" alt="What the picture shows" />
    </li>
  </ul>
</ui-carousel>
```

That is the whole of it. Before any script runs the track is already a scrollable, snapping
strip of pictures: it swipes on a touch screen, glides on a trackpad, and scrolls with the
keyboard. The component adds the parts the platform has no answer for.

**Write real `alt` text.** A carousel of pictures is worth nothing without it.

Add `<p class="carousel__caption">` inside a slide for anything the picture cannot say
itself, and `class="carousel__meta"` is not used here — captions sit over the picture.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `effect` | `slide`, `fade`, `zoom`, `cover` | `slide` | How one picture gives way to the next |
| `loop` | present | absent | The ends join up, so no arrow ever turns off |
| `autoplay` | milliseconds | absent | Advances on its own, with a pause control |
| `per-view` | number | `1` | How many pictures stand in the frame |
| `no-drag` | present | absent | Turns off pointer dragging only |
| `label` | text | — | Names the carousel for a screen reader |

## Properties, methods, events

| Member | Notes |
|---|---|
| `slides` | The slide elements, in order |
| `index` | Which position, from zero; settable |
| `playing` | Whether the slideshow is running |
| `effect`, `loop`, `perView`, `draggable`, `delay` | |
| `goTo(i)` / `next()` / `previous()` | |
| `play()` / `pause()` | |
| `labels` | Overrides every generated name |

| Event | Detail |
|---|---|
| `carousel-change` | `{ index, total }` — once per arrival, however it was reached |
| `carousel-play` | |
| `carousel-pause` | |

## The two families of transition

`slide` is the track itself scrolling, so it keeps the browser's swiping and momentum
untouched.

`fade`, `zoom` and `cover` cannot be done by scrolling: the pictures have to sit **on top of**
one another rather than beside one another. The element stacks them once it loads — which is
why, with no script, every effect falls back to the same scrolling strip.

## Dragging

A touch screen swipes on its own; a mouse cannot, so the pointer drag is built. Two things
commit it, and either is enough:

| | |
|---|---|
| Distance | A fifth of a picture |
| Speed | Still moving when you let go |

Distance alone would throw away the short flick, which is how most people move a carousel.

A press that travelled far enough is a **drag**, and the click it produces is stopped before
it can reach a link inside a slide.

## Keyboard

| Key | |
|---|---|
| `←` `→` | Previous / next |
| `Home` `End` | First / last |

The track carries the tab stop. A scroll container reports `tabIndex: -1` whether or not it
holds focusable children, so nothing puts it in the tab order but the component.

## Autoplay

Content that starts moving by itself has to be stoppable, so the pause control is part of the
component rather than an option. It also stops on its own:

- while the pointer is over it
- while anything inside it has focus
- while the tab is in the background
- at the last picture, unless `loop`

Under `prefers-reduced-motion: reduce` it never starts. Slowing it down would be answering
the wrong request.

## Accessibility

- The carousel is a `group` with `aria-roledescription="carousel"` and the name you give it.
- Each slide is a `group` with `aria-roledescription="slide"` and its position.
- The dots are real buttons carrying `aria-current`, and mark the position by **width** as
  well as colour.
- The status region announces a change somebody made and stays silent while the slideshow
  runs on its own — a region that speaks every few seconds is a region people turn off.
- With one picture the arrows and dots are removed rather than disabled.
- An arrow that turns itself off at an end hands focus on first, because a disabled element
  cannot hold focus.

## Without JavaScript

A scrollable, snapping strip of pictures with real alt text. Swiping, the trackpad and
scrolling all work; the arrows, dots, dragging and the stacked transitions are what the
script adds.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the carousel follows the operating system. To pin it, narrow
the `color-scheme` of any ancestor:

```css
:root {
  color-scheme: light;
}
```

The pictures do not change with the theme, and neither does `--carousel-scrim`: it covers
a picture rather than a component surface, so the caption and the arrows drawn on it keep
white in both.

The example page also answers a frame that posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, which is how a host showing it in an
iframe keeps it in step. Nothing is sent back, and a page that never receives the message
keeps following the system.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, CSS scroll snap, the
`scrollend` event, `inert`, `color-mix()`, and `light-dark()`.

Newer CSS carousel primitives — `::scroll-marker`, `::scroll-button()` and scroll-driven
animations — would replace some of this script, but they are not in every current browser
yet, so nothing here is built on them.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `carousel.html` | Runnable example |
| `carousel.css` | Every style |
| `carousel.js` | Rules, the custom element, and the demo bootstrap |
| `assets/` | The demo pictures, as inline SVG artwork |
