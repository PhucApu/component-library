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

## 5. Four ways to magnify, because a wheel is not universal

Scrolling alone leaves out anyone on a keyboard and anyone on a touch screen. So: the
wheel, a pair of buttons, the `+`, `-` and `0` keys, and a field the level can be typed
into. The range is **life size to four times it**.

Raising the ceiling from `2` is also what exposed a defect that had been there all along:
**a zoom control that turns itself off takes the keyboard with it.** Reset, shrink at life
size and grow at the ceiling each disable themselves as a direct result of being pressed, so
the control being disabled is the one under the finger — and a disabled element cannot hold
focus. Measured: after pressing reset, `document.activeElement` was `BODY`, outside the
panel, and from there `+` left the scale at `1` and the arrow keys left the index at `0`.
The whole keyboard was dead until somebody tabbed back in.

Each control now hands focus to the neighbour still worth pressing before it turns off, with
close as a last resort. This is the **fourth** time in this collection that a control
disabling itself has dropped focus to the body — after Switch's pending state, Pagination's
ends, and this component's own opening focus.

The step is what makes a ceiling that far away usable. The buttons and the `+` `-` keys move
`0.5` at a time, so six presses reach it; the wheel moves `0.25` a notch, twelve notches.
Measured, and the reason the step was left alone when the ceiling was raised from `2`: a
`0.25` button step would have made it twelve presses, and a ceiling nobody can be bothered to
reach is not a ceiling.

Shrink, the level, and grow are one adjustment, so they sit inside one bordered group.
Reset is a different act and stands outside it.

**The field does not clamp while it is being typed into.** Committing on every keystroke is
what makes such a field impossible to use: the `1` of `150` becomes `100` and the rest of
the number has nowhere to go. It settles on Enter or on leaving the field, a number outside
the range is pulled into it, and anything unusable leaves the picture alone and puts the
real level back rather than guessing.

The field also stops key events from reaching the panel. Without that, typing `2` would
magnify the picture and the arrow keys would change it.

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

## 9. The picture keeps the whole width

The arrows sit **on** the picture rather than beside it, so nothing is given up to bars of
empty black either side. They rest at reduced strength and come up fully on hover and on
focus.

Faded, not hidden: something nobody can find is not a control, and hover does not exist on
a touch screen. Each carries a dark scrim of its own so the icon holds against a white
photograph, which is the worst it can face. Measured in that worst case, at resting
strength: `3.31:1`, above the `3:1` a user interface component needs.

## 10. Six thumbnails at a time, a place ahead of you

The strip holds a window of six; the rest are `hidden`, which takes them out of the tab
order as well as out of sight. The arrows at each end **step the picture one at a time**, and
the window slides along to keep up.

The window moves **before** the current picture reaches its edge, not after, so what is
coming next is on the strip when you ask for it. Measured, stepping forward from the first
picture in a set of fourteen:

| Picture | Window |
|---|---|
| 1 | 1–6 |
| 2 | 1–6 |
| 3 | 1–6 |
| 4 | 1–6 |
| 5 | 1–6 |
| 6 | 2–7 |
| 7 | 3–8 |
| 8 | 4–9 |

The lookahead is capped against the size of the window, so it can never ask for more room
than there is and set the window oscillating.

An earlier version had the arrows move the window and leave the picture alone. It was built
that way on request and then changed on request, once it could be seen working: two ways to
move meant two things to learn, and the strip arrows are next to the strip, which is where
somebody looking at the strip expects to change picture. The cost is that they now duplicate
the arrows on the picture — named for the thumbnails rather than repeating a name already on
the page, so a screen reader is not offered the same control twice.

## 11. Thumbnails grow under the pointer, and nothing else moves

Hovering a thumbnail enlarges it and pushes its neighbours along. That is width rather than
a transform, because only real width moves anything else.

The strip's height is **fixed at the largest a thumbnail ever gets**, not a minimum. A
minimum was the first attempt and it was wrong: measured, the strip grew from `84px` to
`91px` under the pointer and shoved the stage above it up by `7px`, breaking the frame the
picture sat in. Fixed at `5.75rem`, the same pass measures `92px` before and after, the
stage unchanged at `589px` and its top unchanged at `58px`, while the thumbnail itself still
grows to `96px`.

## 12. The bottom section folds away, on a notch of its own

The toggle is a **notch rising from the middle of the strip's top edge**, not a button in the
toolbar. A control that hides something should stand on the thing it hides; put it at the far
end of a toolbar and it is just another tool, unattached to what it does. It overlaps the
strip's border by a pixel and drops its own bottom border, so the two read as one piece of
furniture. Measured: `1px` of overlap, `0px` off centre.

It carries `aria-expanded` and renames itself for what it will do next.

**Folded, it gives up everything.** The first version left `22px` of tab and `1px` of border
behind, so the picture stopped short of the panel by `23px` — folding that still keeps a
slice is not folding. The strip's border goes to zero width along with its height, and the
tab pulls itself out of the flow with a negative margin of exactly its own height, which
leaves it drawn over the picture while contributing nothing. A margin was chosen over
switching to absolute positioning because a margin transitions and a change of `position`
jumps. Measured: dock `113px → 0px`, stage `588.8px → 701.8px`, and nothing at all between
the bottom of the picture and the bottom of the panel.

Drawn over the picture, the tab has to be invisible or it is just clutter on the photograph.
Invisible controls are usually a mistake, so this one has **three** ways back and each exists
for a different person:

| Route | Why it is there |
|---|---|
| Pointer within `96px` of the foot of the picture | What was asked for |
| `:focus-visible` | Without it, a keyboard user can never unfold the strip again. Measured: seven tab stops from the folded state |
| A press near the foot | A touch screen never hovers, and this component already refuses to hide the navigation arrows for that reason |

`:focus-visible` rather than `:focus`: a button keeps focus after a click, so `:focus` would
leave the tab showing right after it was pressed to fold the strip, which is the one moment
it must disappear.

Two things had to be got right for the invisible state to be harmless:

- `pointer-events: none` while hidden. Otherwise an unseeable `56×22` button sits over the
  bottom of the picture and eats presses — including the start of a drag on a magnified
  picture.
- **`pointerleave` counts only for a mouse.** A touch always "leaves" the instant it lifts;
  the browser sends `pointerleave` straight after `pointerup`. Measured: tapping near the
  foot turned the tab on and back off in the same breath, so the tap could never reach it.
  For touch, the next press somewhere else puts it away, which happens on its own.

Moving it out of `.lightbox__tool` also moved it out of the rule that makes every icon a
stroked outline, and an SVG path with no styling does not go unstyled — it falls back to
`fill: black`, `stroke: none`. The chevron was a dark smudge at `1.26:1` against the tab
while every other icon sat at `15.43:1`. Now `15.43:1` as well. The regression test checks
**every** path in the panel rather than this one, because the failure is silent: nothing
errors, the icon is simply the wrong colour.

The fold is **animated height**, not `hidden`. Nothing that has been removed can be
transitioned, so `hidden` gave an instant disappearance. `inert` does the job `hidden` was
there for — taking the thumbnails out of the tab order — and `visibility` is delayed to the
end of the transition so the strip is not blanked on the first frame. Measured frame by
frame: `92 · 76.9 · 62.7 · 50 · 39.2 · 30.4 · 23.3 · 17.7 · 13.2 · 9.7 · 6.9 · 4.7 · 3 · 1.8
· 1`.

The reset on opening is applied while the panel is still `display: none`, where no
transition can run. Unfolding it in front of the picture would also have meant measuring the
frame while it was still moving.

The decision survives changing picture, because undoing it would be arguing with somebody
who has just made it. It resets when the viewer is reopened: a strip that is missing on
opening is a strip nobody knows about.

Navigation survives the fold, because the arrows are on the picture rather than in the part
that folds.

## 13. A new picture arrives from the side it came from

Forwards from the right, back from the left. Measured, in pixels from home over successive
frames: `88 · 72.5 · 58 · 45.2 · 34.8 · 26.3 · 19.7 · 14.5 · 10.5 · 7.3 · 4.9 · 3.1 · 1.8 ·
0.9` going forward, and the mirror of it going back, settling at `0` both ways.

The slide needs **its own element** wrapping the picture. The slide and the magnification
both want to move the picture, and one transform cannot hold two unrelated jobs — the zoom
would overwrite the slide mid-animation.

It is done in two steps, because a transition needs a starting point that has already been
rendered: place the picture where it comes from with the transition off, flush the layout,
then clear the transition and send it home. Clearing rather than naming a duration is what
keeps the stylesheet in charge, and therefore what lets `prefers-reduced-motion` remove it —
the same two steps then simply arrive at once.

## 14. Nothing in the chrome is selectable

Pressing a control repeatedly is an ordinary way to use one, and a fast second press is a
double-click. On unprotected chrome that runs a selection out across the whole panel, and it
reads as though the viewer had been highlighted rather than used.

`user-select: none` on the panel; `text` on the caption and the zoom field, which are the
parts somebody might want to copy or edit. Measured before the fix: three quick double
presses on the next arrow selected text across the panel. After: `0` characters.

## 15. Alternative text is the author's to write

A viewer of pictures is worth nothing to a screen reader without it. The element takes the
`alt` from the gallery picture and reads it out with the position when the picture changes,
because swapping the source of an image already on the page announces nothing on its own.

A caption is a different thing and never a replacement: `alt` says what the picture shows,
a caption says something the picture cannot.

## 16. Three layout traps, all the same shape

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

## 17. One picture

The arrows and the strip are removed rather than turned off. Controls that could never do
anything are furniture, and they take tab stops with them. Magnifying still works, because
that is about this picture rather than about the set.

## 18. Motion

The viewer fades in over `180ms`; magnification and dragging ease over `120ms`, except
while a drag is in progress, where easing reads as lag. A new picture slides in over
`260ms`, and the strip folds over `280ms`.

`prefers-reduced-motion: reduce` removes all of it and the exit completes immediately. It
has to name the collapsed state as well as the open one, since that rule carries its own
timing, and it has to name the slide, which works by clearing an inline transition and so
takes whatever the stylesheet says at that moment.

## 19. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

The demo pictures are inline SVG artwork kept in `source/assets/`, a few hundred bytes
each, so the packaged download carries no binary payload.

## 20. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the gallery is a working set of links to the full pictures.
- A wheel gesture over the picture magnifies it and does not move the page.
- The point under the pointer stays under the pointer.
- Focus cannot leave the open viewer, and returns to the picture that was pressed.
- The strip arrows change the picture one at a time, and the window slides along a place
  ahead of where you are.
- Hovering a thumbnail grows it and moves its neighbours, and moves nothing above the strip.
- The strip folds through real intermediate heights rather than vanishing.
- A new picture is away from home just after the arrow is pressed and back home once it
  settles.
- Four fast presses on a control leave the selection empty.
- One picture leaves no arrows and no strip.
