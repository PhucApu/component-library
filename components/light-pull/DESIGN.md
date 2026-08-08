# Light Pull - Design Specification

## 1. Purpose

A switch you work by pulling a cord. The deliverable is the cord: how it curves under a
hand, how it lags behind one, how it swings itself out afterwards. A switch with the same
behaviour and none of that motion is a checkbox, which is why this is an animation.

## 2. The cord is simulated, not choreographed

It is a row of points, each remembering where it was on the step before. That memory is its
velocity — the whole of Verlet integration: move each point by the distance it moved last
time, add gravity, then pull neighbouring points back to a fixed spacing.

Everything readers notice falls out of that rather than being written down:

- It **curves** when pulled, because the joints take the pull in turn.
- It **lags** behind a hand, because a joint only knows where the one above it went.
- It **swings** after release, at a rate its own length gives it, and the swing dies because
  each step keeps slightly less movement than the last.
- A **hard pull and a gentle one do not look the same**, which is the thing no keyframe can
  do at any length.

A pendulum equation would have given a smoother swing and a cord that never bends. Keyframes
would have given the same swing every time. Neither is a cord.

## 3. Fixed steps, and a loop that stops

The simulation runs on a fixed 16ms step, with a frame running as many steps as the time it
was given — up to four. Verlet is not stable under a wandering timestep: a long frame would
throw the rope across the room.

Time left over past four steps is discarded rather than carried. A tab that was hidden for a
minute must not come back and run a minute of rope in one frame.

The loop starts when something moves and stops the frame after the cord has settled. A cord
hanging still asks for no frames at all — the same discipline as `ripple-surface`, and the
reason several of these can sit on a page.

## 4. The handle is a real switch

The cord is an SVG path carrying `aria-hidden`; the control is a `<button role="switch">`
positioned on the handle and moved with it every frame.

A shape drawn inside the cord would have needed a second, invented keyboard path, and the
state would have been something only the eye could read. This way the pointer and the
keyboard work the same control, `aria-checked` is the state, and the accessible name is an
ordinary attribute.

## 5. Taking hold anywhere

A press takes the nearest joint within reach, not the handle. Grab it half way up and the
part above goes taut while the part below hangs free — which is most of what separates a cord
from a stick, and it costs nothing: the simulation already pins whichever joint is held.

## 6. What the cord gives, and the switch's catch

A cord does not stretch. What travels is the switch it is fastened to, so a held joint may be
taken its own share of the cord plus its own share of that travel and no further. Grab it
half way up and you get half the pull, because the cord below your hand is not being pulled.

The travel has to be comfortably more than the threshold at which the switch works. The first
build had them the wrong way round — the cord reached the end of what it would give before it
reached the catch, and the switch could not be worked at all with the pointer.

The switch works on release if the pull passed the catch **at any point in the drag**, which
is how a real one behaves: it clicks as it passes the stop, not at the moment the hand opens.
A press that never moved is a tug at the handle.

## 7. The component decides nothing

It holds a state, reflects it as an attribute, and fires an event. It does not know what a
theme is, and it does not touch the page it sits on.

The demos show a room lighting up and a panel changing its colour scheme — both of them the
page listening, not the component reaching out. A cord that wrote `color-scheme` on the
document would be useless for anything except that one job.

## 8. Visual tokens

| Token | Role |
|---|---|
| `--light-pull-cord` / `--light-pull-width` | The cord |
| `--light-pull-grip` / `--light-pull-grip-edge` | The handle, lit from the side |
| `--light-pull-grip-size` / `--light-pull-grip-length` | How big a thing there is to take hold of |
| `--light-pull-focus` / `--light-pull-shadow` | Focus ring, and what the grip casts |

### Choosing a theme

Every pair resolves through `light-dark()`, so the component follows the operating system
without a script. An embedding page posts `{ type: 'ui-theme', theme }` and the demo narrows
`color-scheme` to that keyword. The message carries no token and no stylesheet, so answering
it adds no dependency on the host.

## 9. Motion

Three numbers decide how it feels: gravity, how much movement a step keeps, and how many
relaxation passes run per step. They were settled by watching the cord rather than by
reasoning about it, and they are the first place to look if it ever feels wrong — the
architecture is not.

`prefers-reduced-motion: reduce` leaves the cord where it hangs and works the switch. There
is nothing to slow down; the swing is the part that goes.

## 10. Responsive behaviour

The cord hangs from the top centre of the box it is given and is re-measured when that box
changes size, so it can sit in a corner of a room on a wide screen and in a narrow strip on a
small one without the page working anything out.

## 11. Variants

| Variant | Shows |
|---|---|
| `default` | A cord in a dark room, and the light it works |
| `physics` | Three lengths taking the same shove |
| `switching` | One cord, two listeners, and the event contract |
| `sizes` | Very short, very long, heavy chain, fine string |
| `states` | On to begin with, the keyboard, and reduced motion |

## 12. Distribution preview

The packaged demo is the `default` variant: the cord, the pull, and something visibly
switched by it, in one frame.

## 13. Acceptance criteria

- A cord at rest draws nothing new and asks for no animation frames.
- Pulling past the catch and letting go works the switch; a short tug does not.
- Taking hold half way up leaves the cord below the hand hanging free.
- Released after a sideways pull, the cord swings and then stops on its own.
- The handle is a `switch` with `aria-checked`, and Space works it.
- `on` is reflected, and setting it from a page fires the event.
- Reduced motion works the switch without a swing.
- No horizontal page overflow from 320px, and no external requests.
