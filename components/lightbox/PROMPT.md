# Recreate Lightbox

You are a Senior Frontend Engineer. Build a Web Component named `<ui-lightbox>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

## The central instruction

The gallery is a list of **links to the full pictures**, not buttons. Before any script
runs, pressing one opens that picture; the element intercepts the press and shows a viewer
instead. The fallback costs nothing, because it is the same file the viewer would show.

The viewer is a `dialog` opened with `showModal()`, which supplies the focus trap, Escape,
the top layer, the backdrop, and inerting the page behind it.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement
is configuration, not a separate build.

- **Default**: a grid of pictures opening into the viewer.
- **Zoom**: magnifying by wheel, button and key, and dragging once magnified.
- **Navigation**: enough pictures that the strip has to scroll, in a set that loops.
- **Captions**: a caption beside the alternative text it never replaces.
- **Aspect**: tall, wide and square pictures in one set.
- **Single**: one picture, where the arrows and the strip are removed rather than disabled.

Each has to run on its own, loading nothing from another origin. Draw the demo pictures as
inline SVG artwork kept beside the source so the packaged download carries no binary
payload.

## Markup contract

```html
<ui-lightbox>
  <ul class="lightbox__gallery">
    <li>
      <a class="lightbox__item" href="{full picture}" data-caption="{optional}">
        <img src="{thumbnail}" alt="{what the picture shows}" />
      </a>
    </li>
  </ul>
</ui-lightbox>
```

Take the alternative text from the gallery picture, and say plainly in the documentation
that writing it is the author's job: a viewer of pictures is worth nothing without it.

## Public API

Support `loop` and `max-zoom` as attributes. Expose `items`, `open`, `index`, `scale`, and
`labels`, plus `show()`, `close(reason)`, `goTo()`, `step()`, `setZoom()`, and
`resetZoom()`. Emit `lightbox-open`, `lightbox-change`, and `lightbox-close` with a reason.

## Magnifying

Offer **three ways**: the wheel, a pair of buttons, and the `+`, `-` and `0` keys. Scrolling
alone leaves out anyone on a keyboard and anyone on a touch screen.

Register the wheel listener **non-passive** — but know why. Browsers make `wheel` passive by
default only on `window`, `document` and `body`; on an ordinary element it already is not,
so the flag is insurance for the day the handler moves rather than the thing that makes it
work. Say so, instead of repeating the folklore.

Do not test this by watching the page scroll: the viewer holds the page still regardless, so
that check passes either way. Read `defaultPrevented` on the gesture, which is the claim.

**Magnify towards the pointer.** Zooming about the centre is the easy version and the wrong
one: the detail someone is pointing at slides away exactly when they try to look closer.
Keep the arithmetic in a rule that never touches the DOM:

```text
newOffset = pointer - ((pointer - offset) / scale) * nextScale
```

Magnification without dragging is useless past the first step, so support dragging with the
pointer and with the arrow keys, and clamp the offset so the picture cannot be pulled away
from the frame. A picture narrower than the frame must not move sideways at all, which is
why that limit is floored at zero.

Arrow keys change picture at rest and drag once magnified. Magnifying is what switches the
mode, which is what makes the switch noticeable.

## The thumbnail strip

Pressing a thumbnail changes the picture. The **arrows at each end scroll the strip** and
never change the picture — a different job, which is why they belong at its ends rather
than beside the picture. Turn each off at its own end, and both off while everything fits.

When the picture changes another way and the matching thumbnail has scrolled out of sight,
slide the strip just far enough to bring it back, **and only then**. A mark showing where
you are is no use if nobody can see it, but scrolling on every change moves the strip out
from under a pointer that is using it.

Measure the strip **after** the dialog is showing. A panel still `display: none` reports
every width as zero, so the strip decides it never overflows and both arrows stay off.

## Layout: three traps of the same shape

Each is a box refusing to shrink below its content:

- Bound the panel's grid column with `minmax(0, 1fr)`, or a long strip pushes the whole
  panel past the viewport instead of scrolling inside it.
- Give the strip `min-inline-size: 0`, or as a flex item it grows past the panel and its
  arrows never wake up.
- Do not size the picture with percentage maxima against a centred grid item: the height
  never resolves and the picture keeps its natural size and is clipped. Fill the frame
  absolutely and let `object-fit: contain` letterbox inside it.

That last one changes what the element's own box means, so work the drawn size out from the
natural proportions rather than reading it off the element. That is the size the drag
limits measure against.

## Presentation and accessibility

- Return focus explicitly to the picture that was pressed. The dialog returns it to whatever
  happened to be focused when the viewer opened, which is not the same thing.
- Hold the page still while the viewer is open; `showModal()` does not do it.
- Announce the position and the alternative text through a `role="status"` region that is
  present and empty beforehand. Swapping the source of an image already on the page
  announces nothing on its own.
- Support a caption separately from the alternative text, and say why they are different.
- With one picture, remove the arrows and the strip rather than disabling them. Controls
  that could never do anything are furniture and they take tab stops with them.
- Fade the viewer in over `180ms` and ease magnification over `120ms`, but never while a
  drag is in progress, where easing reads as lag. `prefers-reduced-motion: reduce` removes
  all of it.
- Define every CSS custom property the component reads inside the component itself.

## Verify before calling it done

Keep the rules that decide things — clamping the magnification, stepping the index, the
zoom arithmetic, clamping the offset, composing the announcement — reachable without a
browser.

Check these explicitly, because each is a place this component quietly goes wrong:

- With scripting disabled the gallery is a working set of links to the full pictures.
- A wheel gesture over the picture magnifies it and leaves the page where it was.
- The point under the pointer is in the same place in the picture before and after
  magnifying. Let the transition settle before reading, or the measurement catches it
  mid-flight and reports a drift that is not there.
- Focus cannot leave the open viewer, and returns to the picture that was pressed.
- The strip arrows move the strip and leave the index alone.
- With one picture there are no arrows and no strip at all.
