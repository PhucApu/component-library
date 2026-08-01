# Recreate Card as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-card>` using plain HTML,
CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

This prompt targets the distributable form: three files and a folder of pictures that a
consumer drops into a project. It is self-contained and assumes no repository, build step,
manifest, or test harness.

## The central instruction

**Nearly all of this is CSS.** The hover treatments, the equal heights, the pinned footers,
the clamped descriptions and the whole-card link are all stylesheet. Make the script justify
each of its lines.

## Output

Produce exactly these, flat apart from the pictures:

```text
card.html
card.css
card.js
README.md
assets/
```

- `card.js` is one ES module holding the DOM-free rules, the custom element, and the demo
  bootstrap. It defines the element only when it is not already registered.
- `card.css` holds every style, driven by component-owned CSS custom properties.
- `card.html` is a runnable example with a grid of article cards, a product card holding a
  button, a horizontal card, and one that is unavailable.
- `assets/` holds the demo pictures drawn as inline SVG artwork, a few hundred bytes each, so
  the package carries no binary payload.
- `README.md` documents the markup contract, the attribute table, the whole-card link and its
  price, and browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page
must be served over HTTP or HTTPS, while noting the cards would still lay out.

## Markup contract

```html
<ui-card interactive effect="lift">
  <div class="card__media"><img src="assets/one.svg" alt="What the picture shows" /></div>
  <div class="card__body">
    <h3 class="card__title"><a href="/story">The title of the thing</a></h3>
    <p class="card__text">A sentence or two about it.</p>
  </div>
  <div class="card__footer">
    <span class="card__meta">14 March</span>
    <button type="button" class="card__action">Save</button>
  </div>
</ui-card>
```

## Public API

Support `interactive`, `effect` (`lift`/`zoom`/`reveal`/`border`/`spotlight`/`none`),
`orientation`, `ratio`, `clamp`, `loading`, `disabled` and `current` as attributes. Emit no
events: a card is links and buttons, and those already have their own.

## The whole-card link

Put the real link on the title and stretch its hit area with a pseudo-element. Wrapping the
card in an anchor produces a link whose accessible name is **`""`** — one a screen reader
announces as nothing at all. A click handler on the card is worse: no keyboard, no context
menu, no opening in a new tab.

**Lift every control except the title's own link, from the stylesheet.** Without it a button
inside the card is hit-tested as the link: it looks pressable and is not, and nothing reports
it. Set `position` as well as `z-index` — `z-index` alone happens to work for a flex item and
fails for anything else.

**Make it opt-in.** The overlay covers the words, so the pointer never reaches them and the
card's text cannot be selected. Measure that with a control group before deciding you do not
believe it.

## Do not add a drag guard

A mouse drag of any real length over a link fires **no click at all**, so there is nothing to
cancel. A guard could only catch a drag too short for the browser to notice — the wobble of a
hand that meant to click — and cancelling that breaks clicking for the people least able to
afford it.

## The rest

- `:is(:hover, :focus-within)` on every treatment. One that only appears under the pointer
  tells a keyboard user nothing, and a touch screen has no hovering.
- `pointer-events: none` on any pseudo-element painted over the card.
- Only the pointer-following treatment gets a `pointermove` listener.
- `block-size: 100%` and one flexible row gives a row of cards equal heights and level
  footers, with nothing measured.
- Apply the horizontal layout only where there is a picture, and span it across both rows.
- Return "no limit" rather than `1` for a missing line clamp.
- Loading: `aria-busy` and a shimmer that becomes a plain block under reduced motion.
  Unavailable: dimmed, `aria-disabled`, press refused, **and a badge saying so in words**,
  with the link keeping its tab stop.
- Put the focus ring round the card, not the link.
- Fall back rather than pass an invalid `aspect-ratio` through.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Press the far corner of an interactive card: it follows the title's link.
- Press a button inside one: it presses the button and does not follow the card.
- Drag across the text of a card with the whole-card link and one without: only the second
  highlights.
- Tab through a card: focus reaches the title, then the button, and the ring is round the
  card.
- Tab to a card whose treatment reveals controls: the row comes out on its own.
- Put three cards of very different lengths in a row: they are the same height and the
  footers line up.
- Press an unavailable card: nothing happens, and you can still tab to it.
