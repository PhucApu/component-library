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

Offer **four ways**: the wheel, a pair of buttons, the `+`, `-` and `0` keys, and a field the
level can be typed into. Scrolling alone leaves out anyone on a keyboard and anyone on a
touch screen. Go from life size to **four times it**.

Size the step against that range rather than picking one and forgetting it: `0.5` on the
buttons and keys is six presses to the ceiling, `0.25` on the wheel is twelve notches. A
ceiling that takes twenty presses to reach is not a ceiling.

**Hand focus on before turning a zoom control off.** Reset, shrink at life size and grow at
the ceiling each disable themselves as a direct result of being pressed, so the control going
away is the one under the finger — and a disabled element cannot hold focus. It drops to the
body, which is outside the panel, and every key stops working. Give each the neighbour that
is still worth pressing, and close as a last resort.

Put shrink, the level, and grow in **one bordered, rounded group**: they are one adjustment.
Reset is a different act and stands outside it.

**The field must not clamp while it is being typed into.** Committing every keystroke makes
it impossible to use: the `1` of `150` becomes `100` and the rest has nowhere to go. Settle
on Enter or on leaving the field, pull an out-of-range number into range, and for anything
unusable leave the picture alone and put the real level back rather than guessing. Stop key
events escaping the field, or typing `2` would magnify the picture.

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

## The picture keeps the whole width

Put the arrows **on** the picture rather than beside it, so nothing is given up to bars of
empty black either side. Rest them at reduced strength and bring them up fully on hover and
on focus.

Faded, not hidden: something nobody can find is not a control, and hover does not exist on a
touch screen. Give each a dark scrim of its own so the icon holds against a white
photograph, and measure that worst case at resting strength rather than only on hover.

## The thumbnail strip

Show a **window of six**; put the rest away with `hidden`, which takes them out of the tab
order as well as out of sight. Pressing a thumbnail changes the picture, and so do the
**arrows at each end, one picture at a time**; the window slides along to keep up. Turn each
arrow off at the end of the *set*, not the end of the window, and hide both while everything
fits.

Slide the window **one place before** the current picture reaches its edge, not after. What
is coming next has to be on the strip already, or asking for it is a leap in the dark. Cap
that lookahead against the size of the window, so it can never ask for more room than there
is.

Grow a thumbnail under the pointer and push its neighbours along. That has to be width
rather than a transform, because only real width moves anything else. Give the strip a
**fixed height sized for the largest a thumbnail ever gets** — a minimum height is not
enough, and a strip that grows shoves the picture upwards every time the pointer crosses it.

## Folding the bottom away

Put the toggle **on the strip, as a notch rising from the middle of its top edge**, not in
the toolbar: a control that hides something should stand on the thing it hides. Overlap the
strip's border by a pixel and drop the tab's own bottom border, so the two read as one piece
of furniture rather than a button parked above a panel.

If the icons are styled by a rule listing the control classes, **add this one to that list**.
A path left out does not go unstyled: SVG falls back to `fill: black`, `stroke: none`, and on
a dark panel the icon becomes a smudge with nothing reported anywhere.

Carry `aria-expanded` and rename it for what it will do next. Keep the decision across a
change of picture, and reset it when the viewer is reopened: a strip that is missing on
opening is a strip nobody knows about.

**Fold by animating the height.** `hidden` is no use — nothing that has been removed can be
transitioned. Use `inert` for the tab order and delay `visibility` to the end of the
transition so the strip is not blanked on the first frame. Apply the reset while the panel is
still `display: none` on opening, where no transition can run: unfolding it in front of the
picture would also mean measuring the frame while it was still moving.

**Folded, give up every pixel.** Zero the strip's border width as well as its height, and
pull the tab out of the flow with a **negative margin of its own height** — a margin
transitions, where switching to `position: absolute` jumps. The picture must reach the bottom
edge of the panel with nothing under it.

The tab is then drawn over the picture, so it has to be invisible, and an invisible control
needs more than one way back. Give it **three**, each for a different person:

- The pointer coming within roughly `96px` of the foot of the picture.
- `:focus-visible` — without it a keyboard user can never unfold the strip again. Use
  `:focus-visible` and not `:focus`, or the tab stays showing right after being pressed to
  fold, since a button keeps focus after a click.
- A press near the foot, because a touch screen never hovers.

Two traps in the invisible state:

- `pointer-events: none` while hidden, or an unseeable button over the bottom of the picture
  eats presses — including the start of a drag on a magnified picture.
- **Honour `pointerleave` only for a mouse.** A touch always leaves the instant it lifts:
  `pointerleave` arrives straight after `pointerup`, and treating it as "gone" undoes the
  reveal in the same breath as the tap that asked for it.

This only works because the arrows are on the picture. Folding away the part that holds the
navigation would leave nothing to navigate with.

## Changing picture

Slide the new picture in from the side it came from: forwards from the right, back from the
left. Give the slide **its own element**, wrapping the picture — the slide and the
magnification both want to move it, and one transform cannot hold two unrelated jobs.

Two steps, because a transition needs a starting point that has already been rendered: place
it with the transition off, flush the layout, then turn the transition back on and send it
home. **Clear** the inline transition rather than naming one, so the stylesheet stays in
charge and `prefers-reduced-motion` there is what decides whether it travels at all.

A step knows its own direction even when looping carries the index the other way; a
thumbnail has only the two positions to compare.

## Nothing in the chrome is selectable

A fast second press on a control is a double-click, and a double-click on unprotected chrome
runs a selection out across the whole panel — it reads as though the viewer had been
highlighted. Pressing a control repeatedly is an ordinary way to use one, so this is not an
edge case. `user-select: none` on the panel; `text` on the caption and the zoom field, which
are the parts somebody might want to copy or edit.

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
- Fade the viewer in over `180ms`, ease magnification over `120ms`, slide a new picture over
  `260ms` and fold the strip over `280ms`, but never ease while a drag is in progress, where
  easing reads as lag. `prefers-reduced-motion: reduce` removes all of it — including the
  collapsed state, which carries its own timing and would otherwise be missed.
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
- The strip arrows change the picture one at a time, and the window slides along a place
  ahead of where you are, so the next thumbnail is always already on the strip.
- Hovering a thumbnail grows it and moves its neighbours, and moves nothing above the strip:
  read the stage's height *and* its top, since a strip that grows pushes rather than
  resizes.
- Folding the strip passes through real intermediate heights rather than jumping to nothing,
  and leaves **nothing** behind it: measure the gap between the bottom of the picture and the
  bottom of the panel, not just that the strip is gone.
- The folded tab is invisible and unclickable, comes back for a pointer near the foot, for a
  tab stop, and for a press, and reopens the strip from each.
- A new picture is somewhere other than home on the frames just after the arrow is pressed,
  and back home once it settles. Measure the position, not the computed style: the
  `translate` property never appears in `transform`.
- Four fast presses on a control leave the selection empty.
- **Every** icon path in the panel is stroked rather than filled, and clears the background
  it sits on. Check them all, not the one you happened to look at: a path that missed the
  icon rule fails silently as a black fill.
- The zoom field accepts a typed number without fighting the typing, clamps one that is too
  large, and ignores one that is not a number. Three figures fit in it without scrolling.
- The ceiling is reachable by button, key and wheel, and the picture is really drawn at it.
  Let the transition settle before reading the scale, or the measurement lands mid-flight.
- The faded arrows still clear `3:1` over a white photograph, at resting strength.
- Hovering a thumbnail moves the ones beside it.
- Folding the bottom away gives the height to the picture and survives a change of picture.
- With one picture there are no arrows and no strip at all.
