# Recreate Flip Card

Build a framework-free Web Component that turns a card about its middle to show a second
face: a picture on the front, details on the back. Plain HTML, CSS 3D transforms and
JavaScript. No framework, no build step, no external request of any kind.

## The central instruction

Do not make the card a button. Its back carries real content — a link, a control — and a
button inside a button is neither valid markup nor operable. Everything else in this
component follows from that one decision.

## Files

```text
flip-card-core.js   the rules, with no DOM in them
shared.js           the <ui-flip-card> element
shared.css          card, faces, toggle, demo page
demo.js             demo wiring and the theme message
assets/*.svg        the plates, drawn as flat vector scenes
variants/{default,grid,content,sizes,states}/index.html
```

## Markup contract

The first two element children are the front and the back, in that order:

```html
<ui-flip-card>
  <div class="front"><img src="assets/blue-ridge.svg" alt="…" /><h2>Blue Ridge</h2></div>
  <div class="back"><p>…</p><p><a href="/plates/1">Read the note</a></p></div>
</ui-flip-card>
```

Wrap them in a turning panel and add a button to each face — `Details` and
`Back to the front` — unless the author marked one with `data-flip-toggle`, in which case
wire that one and leave its words alone. Attributes: `flipped` (reflected), `duration`
(620ms, clamped 120–2000). Expose `flipped`, `faces`, `flip()`, `show(face)`, and a
`flip-card-change` event.

## What a press means

A press on the card's own surface turns it. A press on a link, a button, a field, or anything
else that does something of its own does not, and neither does letting go of a text
selection. Each face carries a real button so the card can be turned without a pointer.

## Take the hidden face out of the page

`backface-visibility` hides a face from the eye and does nothing else: its links stay in the
tab order and its text stays in the accessibility tree, so a keyboard reader tabs into a
control behind the card. Put `inert` on the face turned away — and `aria-hidden` too, for
anything that has not caught up with `inert`.

Focus can be standing on the button that has just been turned away, so a turn asked for from
the keyboard moves focus to the button on the face now showing. Leave focus alone when a
pointer did it: a keyboard-activated click reports a `detail` of zero, which is how the two
are told apart.

## Use a transition, not a frame loop

Nothing hands this card an angle part way through — it is either turning or it is not — so a
CSS transition is the right tool and the cheapest one. (A component that can be *dragged*
part way through needs the opposite: a transition cannot pick up an arc already in progress.)

## Keep one height

Let the front stand in the flow and give the card its height; lay the back over it and let it
scroll when it has more on it. A card that grew to fit its back would shove every card beside
it, at the moment the reader was looking at that one.

## A card with one face is a card

Add no button, answer no press, leave the cursor alone. Turning to a blank takes something
away and offers nothing.

## Presentation

Resolve every colour through `light-dark()` and answer `{ type: 'ui-theme', theme }` from an
embedding page. 620ms on a standard ease; `prefers-reduced-motion: reduce` removes the
transition entirely. Keep cards to a card's width in the demos: a turning card sweeps out of
its own footprint, and the wider it is the further it goes.

## Verify before calling it done

- A press on the surface turns it; a press on a link or button inside does not.
- Nothing inside the face turned away can be tabbed to.
- The toggle turns it from the keyboard and focus follows to the face now showing.
- `flipped` is reflected and settable from a page.
- The card's height does not change when it turns.
- A card with one face has no toggle and does not turn.
- Reduced motion turns without an arc.
- No horizontal overflow at 320px, and no request leaves the page.
