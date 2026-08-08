# Flip Card - Design Specification

## 1. Purpose

Two faces of one thing, and the turn between them. The deliverable is the turn: without it
this is a card with a paragraph under it. That is why it is an animation, and why it sits in
`transitions` beside `flip-book` rather than beside the `card` component.

## 2. The card is not a button, and that decides everything

The back carries real content — a link, a button, sometimes both. A control inside a button
is neither valid markup nor operable, so the card cannot be a button, however much a single
big control would simplify the pointer story.

What follows from that:

- A press on the card's **own surface** turns it. A press on anything that does something of
  its own is left alone, and so is letting go of a text selection.
- Each face carries a **real button**, which is the keyboard's way in. The card itself is not
  focusable, so there is no phantom tab stop wrapping the controls inside it.

The alternative — one big button and a back allowed to hold only text — was rejected because
a back that cannot hold a link is not a back worth turning to.

## 3. The face turned away leaves the page

`backface-visibility` hides a face from the eye and does nothing else. The links on it stay
in the tab order, the text stays in the accessibility tree, and a reader on a keyboard tabs
straight into a control that is, from where they are sitting, behind a card.

So the hidden face carries `inert` — which takes it out of the tab order and out of the
accessibility tree — and `aria-hidden` as well, for anything that has not caught up with
`inert`. It is the single most important line in the component, and the one a flip card
built out of CSS alone cannot have.

Because focus can be standing on the button that was just turned away, a turn asked for from
the keyboard moves focus to the button on the face now showing. A press with a pointer behind
it does not touch focus: nothing was taken from the reader, so nothing needs replacing. The
two are told apart by the click's `detail` being zero, which is what a keyboard-activated
button reports.

## 4. A transition, not a frame loop

Nothing hands this card an angle part way through: it is either being turned or it is not.
So the turn is a CSS transition, which is the cheapest and smoothest thing available.

This is the opposite call from `flip-book`, deliberately. There a leaf can be let go at any
angle, and a transition would restart the arc from wherever the browser believed it was. The
difference is not the shape of the motion but whether anything can interrupt it.

## 5. The card keeps one height

The front stands in the flow and gives the card its height; the back lies over it and scrolls
when it has more on it.

A card that grew to fit its back would shove every card beside it in a grid — at the moment
the reader was looking at that one. Scrolling inside a card is a smaller cost than moving the
page under someone's eye.

## 6. A card with one face is a card

Given one child, the element adds no button, answers no press, and leaves the cursor alone.
Turning to a blank would be worse than not turning: it takes something away and offers
nothing.

## 7. Visual tokens

| Token | Role |
|---|---|
| `--flip-card-surface` / `--flip-card-back` | The two faces |
| `--flip-card-text` / `--flip-card-muted` | Words on them |
| `--flip-card-border` / `--flip-card-shadow` | The edge of the card and what it casts |
| `--flip-card-accent` | The toggle's hover and the focus ring |
| `--flip-card-radius` / `--flip-card-perspective` | Corner, and how strongly the turn reads as 3D |
| `--flip-card-duration` / `--flip-card-ease` | The turn |

### Choosing a theme

Every pair resolves through `light-dark()`, so the component follows the operating system
without a script. An embedding page posts `{ type: 'ui-theme', theme }` and the demo narrows
`color-scheme` to that keyword. The message carries no token and no stylesheet, so answering
it adds no dependency on the host. The plates do not change with the theme.

## 8. Motion

620ms on the standard ease, about as long as a turn can take before it feels like waiting.
`prefers-reduced-motion: reduce` removes the transition: the card arrives on its other side.
There is nothing else to keep, because the turn is the whole component.

## 9. Responsive behaviour

The card is as wide as it is given and as tall as its front. A turning card sweeps out of its
own footprint — the wider it is, the further it goes — so the demo keeps cards to a card's
width rather than letting them stretch across the page.

## 10. Variants

| Variant | Shows |
|---|---|
| `default` | A picture, a back with a link, and both ways of turning it |
| `grid` | Six cards turning independently without moving each other |
| `content` | A back with a working button, and an author-supplied toggle |
| `sizes` | Wide, tall, and a back that scrolls |
| `states` | One face, opened on the back, a missing picture, reduced motion |

## 11. Distribution preview

The packaged demo is the `default` variant: it is the only one that shows the front, the
back, both controls and the keyboard story in one card.

## 12. Acceptance criteria

- A press on the card's surface turns it; a press on a link or button inside does not.
- The face turned away is `inert` and `aria-hidden`, and nothing inside it can be tabbed to.
- The toggle turns the card from the keyboard, and focus follows to the face now showing.
- `flipped` is reflected and can be set by a page.
- Card height does not change when it turns, in a grid or alone.
- A card with one face has no toggle and does not turn.
- Reduced motion turns without an arc.
- No horizontal page overflow from 320px, and no external requests.
