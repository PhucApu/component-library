# Stat Tile

A framework-free Web Component for the headline numbers on an admin dashboard: a value, what
it changed by, an optional sparkline, and an optional meter against a limit.

No React, no TypeScript, no Tailwind runtime, no build step, no dependency, and no network.

## One number is not a chart

A single current value drawn as a one-bar bar chart spends an axis, a grid and a legend
saying what the number already said. The tile is the honest form. A ratio against a limit is a
meter, not a two-slice pie — two slices of a circle is the hardest possible way to read one
percentage.

## The markup

```html
<ui-stat-tile up="good">
  <p class="stat-tile__label">Revenue</p>
  <p class="stat-tile__value" data-value="48290">$48,290</p>
  <p class="stat-tile__delta" data-change="12.4">vs last month</p>
  <ol class="stat-tile__trend" aria-label="Last 12 months">
    <li>32100</li><li>34500</li><li>48290</li>
  </ol>
</ui-stat-tile>
```

| Part | |
|---|---|
| `label` · `value` | Required. **Ordinary paragraphs** — with no script the headline is untouched |
| `data-value` | The number, where the text is the wording |
| `delta` + `data-change` | Optional. The component prepends the arrow and `up 12.4%` |
| `limit` + `data-value` | Optional. Turns the tile into a meter |
| `trend` | Optional. A list of readings; becomes the sparkline |

**The text is never reformatted.** `$48,290` is what you wrote and what stays on screen;
`data-value` carries what the arithmetic needs. The component has no way to know whether your
readers expect `1.28M`, `1,28 Mio` or `128 万`, and guessing wrong is worse than not guessing.

## The direction is a fact; the judgement is yours

Costs rising twelve per cent and revenue rising twelve per cent are the same arrow and
opposite news.

| `up` | A rise reads as | Use for |
|---|---|---|
| `good` (default) | good news | Revenue, signups, uptime |
| `bad` | bad news | Cost, churn, error rate, latency |
| `neutral` | neither | Headcount, inventory |

A change of exactly zero shows **no arrow** and says `no change` — a flat arrow or a zero in
green both suggest something happened.

### Never colour alone

Every change carries three signals in this order of reliability: **an arrow, a word, then a
colour.** That is what makes the tile readable in a grey-scale print-out and for the one
reader in twelve who cannot separate the red from the green — and it is also what makes the
light-theme status colours legal, since two of them sit below the contrast rule by design.

## The meter

```html
<p class="stat-tile__value" data-value="46">46</p>
<p class="stat-tile__limit" data-value="50">of 50</p>
```

The ceiling is markup rather than an attribute, for the same reason as everything else here.
The bar goes between the two lines, so value, bar and ceiling read as one measurement.

| Fraction | Tone | Says |
|---|---|---|
| under `0.75` | ok | — |
| `0.75`–`0.9` | warning | `nearing the limit` |
| `0.9` and up | critical | `at the limit` |

A quota already past fills the bar and **stops there**, with the numbers saying how far past.
A bar drawn beyond its own track has stopped measuring anything.

The unfilled track is the fill's own hue mixed into the surface, so the whole bar reads as one
thing rather than as two colours meeting. Measured fill against track: `3.80` light and `4.14`
dark while comfortable, `4.03` and `3.31` once critical — all clear of the `3:1` a boundary
must reach. **Amber on a light surface reaches only `1.70`** and no lighter step of amber does
better, which is exactly why the state is also in words.

## The sparkline

Twelve or so readings with no axis, no grid and no labels: it says which way this number has
been going, and anything else on it competes with the number it is context for. The line
recedes; only the current reading takes the accent.

A single reading draws nothing — one point cannot show a direction.

Once drawn, the `<ol>` is hidden from the eye and **never from the page**, so a screen reader
still has every reading. There is no toggle: the headline is the value and the change, both of
which stay on screen, so twelve numbers do not earn a control of their own.

## A row of tiles is layout, not a component

There is deliberately no `<ui-stat-row>`. A row arranges tiles and adds no meaning, and a
wrapper would invite a date filter inside each card — when the rule is **one filter row above
everything it scopes**, so every number on the page agrees with every other.

Copy this instead:

```css
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  grid-template-rows: auto auto auto auto;
  gap: 0.75rem;
}

.stat-row > ui-stat-tile {
  grid-row: span 4;
  grid-template-rows: subgrid;
}
```

`subgrid` is what makes every label, value and change sit on the same line as its neighbours.
Without it each tile packs its own contents and a longer label in one card pushes that card's
number out of step — which reads as sloppiness before anyone can say why. Where `subgrid` is
unsupported the row still works; the lines simply do not agree.

## The hero figure

`size="hero"` for the one number a view leads with. **Exactly one per view** — two is a tie,
and a tie is the reader deciding what the page is about instead of the page saying so. The
component cannot enforce that and does not pretend to.

Same sans as everything else: a display or serif face here reads as decoration that wandered
in from a marketing page. Figures stay **proportional** — equal-width digits are for columns
that must line up, and at this size they make `1,284` look loose because a `1` is given the
width of a `0`.

## Attributes, properties, methods

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `up` | `good` `bad` `neutral` | `good` | What a rise means |
| `size` | `default` `hero` | `default` | Hero is the one number a view leads with |
| `no-trend` | present | absent | Drop the sparkline; the readings stay in the page |
| `loading` | present | absent | Fade and hold the number |
| `error` | string | — | Say what went wrong; the label stays |

| Member | Notes |
|---|---|
| `value` · `change` · `limit` · `trend` | The numbers behind the text |
| `polarity` · `tone` | What was asked for, and what it means here |
| `refresh()` | Re-read the markup after the page rewrites it |
| `labels` | Overrides every generated string |

`refresh()` exists because the numbers live in text nodes rather than attributes. Watching
those would mean a `MutationObserver` per tile observing every character; one method is the
honest interface.

There are **no events**. A tile is there to be read, not to report.

## States

- **`loading`** fades the number and holds it. A skeleton would throw away a figure the reader
  is still looking at and flash the layout for something about to be almost the same.
- **`error`** says what went wrong and keeps the label, so the tile still names the number
  that is missing.
- **An empty value** says `Not available`. A dash is a character somebody has to decode, and a
  zero is a claim. Zero itself is a real measurement and is shown as one.

## Accessibility

- The headline is ordinary paragraphs and needs no enhancement to be read.
- The meter is announced as a `meter` with its minimum, maximum and current value.
- The sparkline is `aria-hidden` and its readings stay in the page.
- Every judgement is arrow, word and colour — never colour alone.

## Reduced motion

`prefers-reduced-motion: reduce` removes the meter's fill transition. The bar is at its length
rather than travelling to it.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `light-dark()`,
`color-mix()`, `ResizeObserver`, inline SVG, and `subgrid` for the row.

## Files

| Path | Contents |
|---|---|
| `stat-tile.html` | Runnable example |
| `stat-tile.css` | Every style, including the row layout to copy |
| `stat-tile.js` | The rules, the custom element, and the demo bootstrap |
