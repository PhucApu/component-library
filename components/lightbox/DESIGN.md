# Lightbox - Design Specification

## 1. Purpose

Let someone look at a picture properly: full size, magnified where they want it, and with
the rest of the set a press away.

## 2. The gallery is a list of links

Not buttons. A link to the full picture works before any script has loaded and keeps
working if it never does — pressing one simply opens that picture. The element intercepts
those presses and shows the picture in a viewer instead.

That is the whole progressive-enhancement story, and it costs nothing: the fallback is the
same file the viewer would have shown.

## 3. The viewer is a dialog

`showModal()` supplies the focus trap, the Escape key, the top layer, the backdrop, and
inerting the page behind. The same decision as Drawer, for the same reasons.

Two things it does not supply, both carried over from Drawer: the page behind still scrolls
unless the root is held, and the backdrop has no element of its own, so a press on it
arrives with the dialog as the target.

Focus is returned explicitly to the picture that was pressed rather than left to the
dialog, which returns it to whatever happened to be focused when the viewer opened.

Measured: after fourteen `Tab` presses focus is still inside the panel; after Escape it is
back on the gallery link that opened it.

## 4. Visual tokens

| Token | Value | Role |
|---|---|---|
| `--lightbox-surface` | `#12141a` | Viewer background |
| `--lightbox-bar` | `#1a1e26` | Toolbar and strip |
| `--lightbox-text` | `#f4f6fa` | Controls |
| `--lightbox-muted` | `#a8afbc` | Counter and caption |
| `--lightbox-border` | `#2e3440` | Rules and outlines |
| `--lightbox-accent` | `#86a0ff` | The current thumbnail |
| `--lightbox-backdrop` | `rgb(6 8 12 / 0.82)` | The dimmed page |

## 5. Three ways to magnify, because a wheel is not universal

Scrolling alone leaves out anyone on a keyboard and anyone on a touch screen. So: the
wheel, a pair of buttons, and the `+`, `-` and `0` keys.

The wheel listener is registered **non-passive**, and honestly this is insurance rather
than the thing that makes it work: browsers make `wheel` passive by default only on
`window`, `document` and `body`, and this listener is on an ordinary element where it
already is not. Measured — removing the flag changes nothing here. It is written down so
the handler survives being moved somewhere the default does apply.

The page cannot scroll during any of this anyway, because the viewer holds it still. So
watching `scrollY` proves nothing, and the check reads `defaultPrevented` on the gesture
instead, which is the claim actually being made.

Measured: a wheel gesture over the picture moves the magnification from `1` to `1.25` and
arrives at the document already cancelled.

## 6. Magnifying towards the pointer

Zooming about the centre is the easy version and the wrong one: the detail someone is
pointing at slides away from them exactly when they try to look at it closer.

The arithmetic is a rule that never touches the DOM, so it can be checked on its own:

```text
newOffset = pointer - ((pointer - offset) / scale) * nextScale
```

Measured on the Default variant: a point at `(120, -60)` from the frame centre sits at the
same place in the picture — `u 0.6376`, `v 0.3937` — before and after magnifying to `2.5`,
and the applied offset is exactly the `-180px 90px` the rule predicts.

## 7. Magnifying without dragging is useless

Enlarged three times, only the middle of the picture can be seen. Dragging works with the
pointer and with the arrow keys, and the offset is clamped so the picture cannot be pulled
away from the frame. A picture narrower than the frame cannot move sideways at all, which
is why the limit is floored at zero rather than allowed to go negative.

## 8. One conflict, resolved by mode

Arrow keys want to be two things at once. At rest they change picture; once magnified they
drag. Magnifying is what switches the mode, which is what makes the switch noticeable.
`Home` and `End` always jump to the first and last picture.

## 9. The strip scrolls; the arrows at its ends do not change the picture

Pressing a thumbnail changes the picture. The arrows move the strip, which is a different
job and is why they sit at the ends of the strip rather than beside the picture.

They come alive only when the strip has somewhere to go, and each turns off at its own end.

When the picture is changed some other way and the matching thumbnail has scrolled out of
sight, the strip slides just far enough to bring it back — **and only then**. A mark showing
where you are is no use if nobody can see it, but scrolling on every change would move the
strip out from under a pointer that is using it.

## 10. Alternative text is the author's to write

A viewer of pictures is worth nothing to a screen reader without it. The element takes the
`alt` from the gallery picture and reads it out with the position when the picture changes,
because swapping the source of an image already on the page announces nothing on its own.

A caption is a different thing and never a replacement: `alt` says what the picture shows,
a caption says something the picture cannot.

## 11. Three layout traps, all the same shape

Found by measuring, and all variations on a box refusing to shrink below its content:

- The panel's grid column was automatic, so a long strip pushed the whole panel past the
  viewport instead of scrolling inside it. `grid-template-columns: minmax(0, 1fr)`.
- The strip is a flex item, so it grew to `1086px` inside a `1000px` panel and its arrows
  never woke up. `min-inline-size: 0` — the third time this rule has come up in this
  collection, after Table and its scroll region.
- The picture was sized with percentage maxima against a centred grid item, which leaves
  the height unresolved, so it kept its natural size and was clipped. It now fills the
  frame absolutely and `object-fit` letterboxes inside it.

The last of those changes what the element's own box means, so the drawn size is worked out
from the natural proportions rather than read off the element. That is the size the drag
limits measure against.

## 12. One picture

The arrows and the strip are removed rather than turned off. Controls that could never do
anything are furniture, and they take tab stops with them. Magnifying still works, because
that is about this picture rather than about the set.

## 13. Motion

The viewer fades in over `180ms`; magnification and dragging ease over `120ms`, except
while a drag is in progress, where easing reads as lag. `prefers-reduced-motion: reduce`
removes all of it and the exit completes immediately.

## 14. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

The demo pictures are inline SVG artwork kept in `source/assets/`, a few hundred bytes
each, so the packaged download carries no binary payload.

## 15. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the gallery is a working set of links to the full pictures.
- A wheel gesture over the picture magnifies it and does not move the page.
- The point under the pointer stays under the pointer.
- Focus cannot leave the open viewer, and returns to the picture that was pressed.
- The strip arrows scroll the strip and never change the picture.
- One picture leaves no arrows and no strip.
