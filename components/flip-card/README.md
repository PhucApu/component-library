# Flip Card

A card with two faces. The front carries a picture; a press turns the card about its middle
to show what is written on the back, and another press brings it back.

## Markup contract

The first two element children are the front and the back, in that order:

```html
<link rel="stylesheet" href="flip-card.css" />
<script type="module" src="flip-card.js"></script>

<ui-flip-card>
  <div class="front">
    <img src="assets/blue-ridge.svg" alt="Ridges fading into pale distance" />
    <h2>Blue Ridge</h2>
  </div>
  <div class="back">
    <h3>Blue Ridge</h3>
    <p>Four ranges, each paler than the last.</p>
    <p><a href="/plates/1">Read the note on this plate</a></p>
  </div>
</ui-flip-card>
```

The element wraps them in a turning panel and adds a button to each face — `Details` on the
front, `Back to the front` on the back. Mark a button of your own with `data-flip-toggle` and
it wires that one instead, so the words on it are yours.

A card given only one child has nowhere to turn to: it stays a card, gains no button, and
does not answer a press.

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `flipped` | absent | Which way round the card is. Reflected, so it always says where the card stands. |
| `duration` | `620` | How long the turn takes, in milliseconds. Clamped to `120`–`2000`. |

## Properties, methods, events

- `flipped` — get or set which face is showing.
- `faces` — the two face elements, front first.
- `flip()` — turn it over.
- `show('front' | 'back')` — turn it to a particular face.
- `flip-card-change` — fired when the card turns. `detail` carries `{ flipped }`.

## What a press means

A press on the card's own surface turns it. A press on anything that does something of its
own — a link, a button, a field — is left alone, and letting go of a text selection is not a
press on the card either.

This is why the card is not itself a button: its back carries real controls, and a button
inside a button is neither valid markup nor operable. Each face therefore carries a real
button, which is how the card is turned without a pointer.

## The face turned away is out of the page

The hidden face carries `inert` and `aria-hidden`, so it is out of the tab order and out of
the accessibility tree — not merely out of sight. A face nobody can see still carries its
links, and without this a reader on a keyboard would tab straight into them behind the card.

When the turn is asked for from the keyboard, focus follows the card round to the button on
the face now showing. A press with a pointer behind it leaves focus alone.

## Height

The front stands in the flow and gives the card its height; the back lies over it and scrolls
if it has more on it. A card that grew to fit its back would shove every card beside it, at
the moment the reader was looking at that one.

## Reduced motion

Under `prefers-reduced-motion: reduce` the card arrives on its other side without turning.
The turn is the whole of what this component does, so there is nothing to slow down — only
something to leave out.

## Without JavaScript

The two faces are ordinary blocks, one after the other. Nothing is hidden behind the script.

## Light and dark

Every colour resolves through `light-dark()`, so the component follows the operating system
on its own. An embedding page that wants to pin one theme posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }` to the frame, which narrows `color-scheme`.

## Browser support

Needs custom elements, CSS 3D transforms with `transform-style: preserve-3d`, the `inert`
attribute and `light-dark()`: Chrome and Edge 123+, Safari 17.5+, Firefox 128+.

## Running the files

Open `flip-card.html` from a local server so the module and the pictures load over HTTP.

## Files

| File | Holds |
|---|---|
| `flip-card.html` | The demo page |
| `flip-card.css` | The card, its custom properties, and the demo page chrome |
| `flip-card.js` | The element, its rules, and the demo wiring |
| `assets/` | The plates the demo shows |
