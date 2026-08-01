# Card

A framework-free Web Component for article and product cards: a whole-card link that keeps
its name, controls inside it that stay reachable, and hover treatments that answer the
keyboard too.

No React, no TypeScript, no Tailwind runtime, no dependencies.

Nearly all of it is stylesheet. The script exists for three things CSS cannot do, and they
are listed at the bottom.

## Markup contract

```html
<ui-card interactive effect="lift">
  <div class="card__media">
    <img src="photo.jpg" alt="What the picture shows" />
  </div>
  <div class="card__body">
    <p class="card__eyebrow">Category</p>
    <h3 class="card__title"><a href="/story">The title of the thing</a></h3>
    <p class="card__text">A sentence or two about it.</p>
  </div>
  <div class="card__footer">
    <span class="card__meta">14 March</span>
    <button type="button" class="card__action">Save</button>
  </div>
</ui-card>
```

Every part is optional except a title. A card with no picture keeps no room for one.

For a set of cards, put each in a list item — `<ul><li><ui-card>…` — so the number of them
is announced.

## The whole-card link

`interactive` makes the entire card the target of its title's link. The real link is on the
title; a pseudo-element stretches its hit area over the card.

Measured, and the reason it is done this way:

| | Accessible name |
|---|---|
| Stretched link | `"A quiet week in the harbour"` |
| The card wrapped in an `<a>` | `""` |

A link named nothing is a link a screen reader announces as nothing.

**Two things follow from it.**

Controls inside the card would be swallowed by the overlay — measured: a button is
hit-tested as the link, so it looks pressable and is not. The component lifts every control
except the title's own link, so an author cannot get this wrong.

The pointer never reaches the words. Measured: a paragraph under the overlay selected **0**
characters where the same paragraph beside it selected 48. That is the price of the pattern,
and it is why `interactive` is **not** the default. Leave it off and only the title is a
link, and the card's text can be selected and copied like any other text.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `interactive` | present | absent | The whole card is the title's link |
| `effect` | `lift`, `zoom`, `reveal`, `border`, `spotlight`, `none` | `lift` | The hover treatment |
| `orientation` | `vertical`, `horizontal` | `vertical` | Picture above or beside |
| `ratio` | e.g. `4 / 3` | `16 / 9` | The picture's shape |
| `clamp` | number | — | Lines of description to keep; without it, all of them |
| `loading` | present | absent | Sets `aria-busy`; style `.card__skeleton` blocks |
| `disabled` | present | absent | Dimmed, `aria-disabled`, and the press refused |
| `current` | present | absent | An accent ring and `aria-current` |

## Hover treatments

| Effect | |
|---|---|
| `lift` | Rises, gains a shadow, warms its border |
| `zoom` | The picture grows inside a frame that does not, so nothing reflows |
| `reveal` | A row of controls slides up over the picture |
| `border` | An accent ring and a soft glow |
| `spotlight` | A light that follows the pointer |
| `none` | For a card that is content rather than a control |

**Every one answers `:focus-within` as well as `:hover`.** A treatment that only appears
under the pointer tells a keyboard user nothing, and a touch screen has no hovering at all.
That matters most for `reveal`, whose buttons are in the tab order whether or not they are
on show.

`prefers-reduced-motion: reduce` removes all of it, and turns the loading shimmer into a
plain block.

## Layout

Cards fill their grid cell and the body takes the slack, so a row of them is the same height
with the footers in line. Nothing measures anything — it is `block-size: 100%` and one
flexible row.

```css
.your-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 1rem;
}
```

`clamp` keeps a long description to a set number of lines. Leaving it off means no limit —
"no limit" and "one line" are different answers, so nothing is applied where nothing was
asked.

## Accessibility

- The title is a real heading with a real link. Nothing here replaces either.
- A disabled card keeps its tab stop and carries `aria-disabled`: a control nobody can reach
  is a control nobody can discover is unavailable, and a disabled element cannot hold focus
  at all.
- States are never told by colour alone — an unavailable card carries a badge that says so,
  and the current one wears a ring.
- The focus ring goes round the **card** when its link has focus, because the card is what is
  being activated.

Measured contrast on the card surface: title `16.11:1`, price `16.11:1`, description
`7.9:1`, eyebrow `7.04:1`, badge on its scrim `19.55:1`, primary action `7.51:1`.

## What the script is for

Three things, and no more:

1. Reading the attributes into the custom properties and data attributes the stylesheet uses.
2. Following the pointer for `spotlight` — and only for `spotlight`. A listener on every card
   in a grid, firing on every pointer move, is a cost nobody asked for.
3. Refusing the press on a card that is `disabled`.

There are no events: a card is links and buttons, and those already have their own.

## Without JavaScript

The cards lay out, the pictures show, the titles are links, and the hover treatments work,
because all of that is CSS. What is lost is the whole-card link, the spotlight, and the
refusal on a disabled card.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the card follows the operating system. To pin it, narrow the
`color-scheme` of any ancestor:

```css
:root {
  color-scheme: light;
}
```

`--card-scrim` is the exception: it covers a picture rather than the card, so it stays
dark in both themes and the badge and reveal row stay light-on-dark.

The example page also answers a frame that posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, which is how a host showing it in an
iframe keeps it in step. Nothing is sent back, and a page that never receives the message
keeps following the system.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `:has()`, `:focus-within`,
`aspect-ratio`, `line-clamp`, `color-mix()`, and `light-dark()`.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `card.html` | Runnable example |
| `card.css` | Every style |
| `card.js` | Rules, the custom element, and the demo bootstrap |
| `assets/` | The demo pictures, as inline SVG artwork |
