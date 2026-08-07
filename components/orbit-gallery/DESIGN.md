# Orbit Gallery - Design Specification

## 1. Purpose

A set of pictures shown as an object rather than a list: they stand around a ring, the ring
turns, and the one you point at comes out of it. What is on offer is the motion itself. Strip
the turning away and there is nothing left to keep, which is why this is an animation rather
than a carousel with an unusual skin.

## 2. One number describes the ring

The whole position of the ring is one number, `angle`, measured in item space: the picture at
the front is `angle / step`, where `step` is `360 / count`. Everything reads that number and
nothing else. The drift adds to it, a drag writes it, a throw decays into it, and the arrow
keys step it.

Two consequences follow, and both are the reason for the choice:

- The states cannot disagree. There is no separate "current index" to fall out of step with
  the transform, so a ring stopped mid-turn is still exactly describable.
- Stopping is free. Pointing at a picture stops the ring where it stands rather than snapping
  to the nearest place, because nothing downstream needs a whole number to work with.

The DOM rotation is the negative of `angle`. That single sign is where the direction of the
drag, the throw and the arrow keys all come from.

## 3. The radius is worked out, not stated

Each picture takes a chord of the circle, so the radius that keeps neighbours apart follows
from how many there are:

```text
radius = (itemWidth + gap) / 2 / tan(pi / count)
```

Five pictures get a narrow ring, twelve get a wide one, and the author states neither. A
`radius` attribute overrides it for a layout that needs a particular size.

The width in that formula is the computed width, not a measured box. An item is already
turned in three dimensions, so its box on screen is the projection of it rather than its
width, and measuring the projection would shrink the ring every time it turned.

## 4. Two writes per frame

The frame loop writes the ring's rotation and, for each picture, how much light it keeps.
Nothing else changes: the placement of a picture on the ring is a static transform, so the
browser has one composited rotation to do rather than a layout to redo.

Perspective already makes the far side of the ring smaller, so depth only has to take light
out of it. `facing` is the cosine of the angle to the front, opacity runs from `1` head-on to
`0.28` edge-on, and the same number decides whether a picture can be pointed at: the far half
is turned away and hidden by `backface-visibility`, and a hidden picture that still answered
the pointer would stop the ring for no reason the reader could see.

The loop runs only when there is something to do. A ring that is paused, hovered, focused, on
a hidden tab, or drifting at `speed="0"` requests no frames at all.

## 5. Stopping and choosing are two different acts

Pointing at a picture stops the drift at the angle the ring had, and resumes from there
rather than from the place it was heading for. That is all pointing does.

The picture singled out — lifted out of the ring towards the viewer while the rest fade
back — is the one facing the viewer with the ring at rest on it. Never the one under the
pointer.

The two were the same thing at first, and the pointer was the wrong one to carry it. A
pointer crossing a moving ring brushes pictures it never meant to ask for, so the effect
fired on the way past something else and the reader had no way to say which picture they
actually wanted. Bringing a picture round to the front is a deliberate act; hovering over
one is not.

This is also what makes the keyboard whole rather than a consolation. A gallery that
answered only the pointer would be unreadable without one, and here the arrow keys do the
same act by a different route: each step lands the ring on a picture, which is exactly the
condition that singles it out. Nothing extra had to be invented for focus. It is why the
pictures themselves are not focusable — they are not controls, and making each one focusable
would promise an action none of them has.

## 5a. Two ways in, one act

Dragging is the direct way to turn the ring and the one nobody is told about. It also asks
for a gesture some readers cannot make accurately, and on a first visit it asks every reader
to guess that the ring can be taken hold of at all. So an arrow stands at each side of the
stage and does exactly what a drag of one step would do.

They are ordinary buttons, which is what makes them work for a mouse, a finger and a keyboard
without three implementations. Two consequences had to be built for rather than assumed:

- A press that becomes a drag must not also count as a press. The pointer is captured only
  once the movement has passed the drag threshold, because capturing on the way down
  redirects the click that follows to the stage and the arrow would never fire at all.
- The arrows stand on the stage, not on the ring. On the ring they would be turned with it,
  dimmed by depth, and hidden along with the half that faces away.

## 5b. Taking the ring over stops the drift

A deliberate turn — a drag, an arrow, a key — parks the ring where it lands. Drift that
carried on regardless would take the picture the reader just chose straight back off the
front, which makes the choice pointless and the arrows worse than nothing.

Pointing does not park it: stopping to look is not the same as choosing, and the drift picks
up again when the pointer leaves. `resume()` is how a page starts the drift after a reader
has taken over — the same method that lifts `paused`, because from the outside they are the
same request.

## 6. The lift is two elements, not one

The item carries the ring placement; the tile inside it carries the lift and the zoom. One
element cannot be both turned into position by the frame loop and scaled back out of it by a
stylesheet without the two fighting for the same property every frame.

The split also keeps the transitions honest: the item's transform changes only when something
lifts, so it can carry a transition without smearing the drift, and the per-frame opacity
lives on the item while the hover fade lives on the tile, where nested opacity multiplies the
two on its own.

## 7. Dragging and throwing

A drag across the full width of the stage turns the ring half a way round. That ratio is the
whole mapping: it is independent of how many pictures there are, so a wide ring and a narrow
one feel the same under the hand.

A throw is what the pointer was doing in its last 120ms, not the average of the drag. A slow
pull that ends in a flick is a flick; averaging would cancel it. The throw decays by a
constant per frame and is declared over below a threshold rather than crawling towards zero
forever.

Where it stops is not where it stays. Friction almost never leaves a picture square to the
viewer, and asking the reader to land one by hand would make the whole effect a matter of
luck, so the ring travels the last few degrees onto the nearest picture itself.

It only does that when the ring is going to stay there — under the pointer, with focus, when
`paused`, or at `speed="0"`. A ring about to drift on again would land, single a picture
out, and lose it again: a wobble at the end of every throw.

`touch-action: pan-y` gives sideways to the ring and leaves downwards to the page.

## 8. What the status region says, and when

The ring drifts past picture after picture. A live region that named each one would never
stop talking, so it says nothing while the ring is drifting or being dragged, and reports the
picture at the front once it has stopped — which is exactly when a reader has asked for it.

## 9. One picture is not a ring

With one picture the radius is zero. Turning would spin it about its own edge and hide it for
half of every turn while showing nothing else, so a single picture does not drift, drag, or
step. It stands in the middle.

A picture that fails to load keeps its place. Closing the gap would move every other picture
for a reason the reader cannot see, so the place stays and says what happened in words.

## 10. Visual tokens

| Token | Role |
|---|---|
| `--orbit-surface` | The page surface behind the demo |
| `--orbit-tile` | What shows behind a picture that has not loaded |
| `--orbit-text` / `--orbit-muted` | Body text and the unavailable note |
| `--orbit-border` | Tile edge |
| `--orbit-focus` | Focus ring on the stage |
| `--orbit-shadow` | Under a lifted picture |
| `--orbit-item-width` / `--orbit-item-height` | The size of one place on the ring |
| `--orbit-gap` | Breathing space between neighbours, which is half of what decides the radius |
| `--orbit-perspective` | How strongly the ring reads as three-dimensional |
| `--orbit-front-lift` / `--orbit-front-zoom` | How far the picture at the front leaves the ring and how much it grows |
| `--orbit-stage-height` | Room for the front picture to leave the ring and still cast its shadow inside the stage |
| `--orbit-move` / `--orbit-ease` | The lift and fade timing |

### Choosing a theme

Every pair resolves through `light-dark()`, so the component follows the operating system
without a script. An embedding page posts `{ type: 'ui-theme', theme }` and the demo narrows
`color-scheme` to that keyword. The message carries no token and no stylesheet, so answering
it adds no dependency on the host. The pictures do not change with the theme: a picture is a
picture in both.

## 11. Motion

Drift defaults to 12 degrees a second — a whole turn every thirty seconds, slow enough that
the ring reads as a standing object. Lift and fade take 280ms on the standard ease.

`prefers-reduced-motion: reduce` removes the drift and the coasting and drops the transitions,
and the arrow keys arrive without travelling. Dragging still works, because it is a gesture
the reader is performing rather than motion happening at them.

## 12. Responsive behaviour

The place size is a clamp against the viewport, so the ring narrows with the page. Below
about `26rem` the ring is wider than its stage: pictures at the sides run past the edge and
are clipped there rather than being scaled into illegibility. A ring continuing off the edge
of its frame is the honest reading of a ring, and the stage never lets the page overflow
sideways.

## 13. Variants

| Variant | Shows |
|---|---|
| `default` | Eight pictures drifting, stopping under the pointer, answering the keyboard |
| `density` | Five, eight, and twelve on the same element, with the radius following the count |
| `drag` | Dragging, throwing, settling onto the nearest picture, the arrows, and what `no-drag` takes away |
| `speed` | Two speeds and both directions |
| `states` | Held still, a picture that never arrived, one picture, and reduced motion |

## 14. Distribution preview

The packaged demo is the `default` variant: it is the only one that shows the drift, the
hover and the drag together in a single ring.

## 15. Acceptance criteria

- The ring drifts, stops under the pointer at the angle it had, and resumes from there.
- Pointing at a picture does not single it out.
- Dragging turns the ring; letting go while moving coasts, settles onto the nearest picture,
  and that picture lifts while the others fade.
- The arrow either side turns the ring one picture; a drag that starts on an arrow turns the
  ring and does not press it.
- A drag, an arrow or a key stops the drift; `resume()` starts it again.
- Three tab stops and no more: the ring and the two arrows. Arrow keys, Home and End turn the
  ring and single out the picture they land on.
- The status region is quiet while drifting and reports the front picture once stopped.
- Reduced motion removes the drift, the coasting and the transitions.
- A picture that fails to load keeps its place and says so.
- One picture stands still.
- No horizontal page overflow from 320px, and no external requests.
