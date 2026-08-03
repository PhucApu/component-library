# Recreate Stat Tile

You are a Senior Frontend Engineer. Build a Web Component named `<ui-stat-tile>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

## What it is, and the two things it refuses to be

The headline number on an admin dashboard: a value, what it changed by, an optional sparkline,
an optional meter against a limit.

It is **not a one-bar bar chart** — an axis, a grid and a legend saying what the number already
said. It is **not a two-slice pie** — the hardest possible way to read one percentage. Both
look like thoroughness, which is why they keep getting built.

## The markup is the headline

```html
<ui-stat-tile up="good">
  <p class="stat-tile__label">Revenue</p>
  <p class="stat-tile__value" data-value="48290">$48,290</p>
  <p class="stat-tile__delta" data-change="12.4">vs last month</p>
  <ol class="stat-tile__trend"><li>32100</li><li>34500</li><li>48290</li></ol>
</ui-stat-tile>
```

The label, the value and the change are **ordinary paragraphs that need no script**. The only
thing the script draws is the sparkline. `data-value` carries the number while the text
carries the wording — and **never reformat the text**: you cannot know whether the reader
expects `1.28M`, `1,28 Mio` or `128 万`, and guessing wrong is worse than not guessing.

Put the ceiling in markup too, not in an attribute:

```html
<p class="stat-tile__limit" data-value="1024">of 1 TB</p>
```

An attribute would need a second attribute for its wording. The markup form needs none, and it
is the same rule the rest of the component already follows.

## The direction is a fact; the judgement is the author's

Costs rising twelve per cent and revenue rising twelve per cent are the same arrow and
opposite news. Read the direction from the sign; take the judgement from `up`
(`good` | `bad` | `neutral`). `neutral` reports the direction and declines to judge it —
headcount going up is neither, and green says otherwise.

**Zero is not a small rise.** No arrow, and the words `no change`.

### Three signals, and colour is the last of them

Arrow, word, then colour. This is not politeness — it is what makes the tile survive a
grey-scale print-out and the reader who cannot separate red from green, and it is what makes
the light-theme status inks usable at all.

Hold the delta ink to **4.5:1** (it is text) against both surfaces, and check it: a status
*fill* is usually too light for a word. Measured here, `#0ca30c` reaches only 3.27 on white
and `#d03b3b` only 3.63 on the dark surface, so the delta uses different steps from the bar.

## The meter, and the colour that cannot work

The fill carries severity; the track is **the fill's own hue mixed into the surface**, so the
whole bar reads as one measurement rather than two colours meeting. A grey track under a
coloured fill is two different things touching.

Measure fill against track and expect a surprise: amber on a light surface reaches about
`1.70`, and **no lighter step of amber can pass** — it is too pale to carry a boundary against
anything lighter than itself. Do not solve this by reaching for grey. Solve it the way the
palette prescribes: **say the condition in words** — *nearing the limit*, *at the limit* — in
every state that has one, so nothing depends on the bar's colour.

A quota already past **fills the bar and stops there**. A bar drawn beyond its own track has
stopped measuring anything.

Announce it as a `meter` with its minimum, maximum and current value.

## The sparkline

No axis, no grid, no labels — it says which way the number has been going, and anything else
competes with the number it is context for. The line recedes; only the current reading takes
the accent.

- **A flat run goes through the middle**, not along the floor: pinned to the bottom it reads
  as "zero" rather than "unchanged".
- **A single reading draws nothing.** One point cannot show a direction.
- Once drawn, keep the readings in the page, visually hidden. **No toggle** — the value and
  the change are already on screen, so twelve numbers do not earn a control of their own.

## A row of tiles is layout, not a component

Do **not** build `<ui-stat-row>`. A row arranges tiles and adds no meaning, and a wrapper
invites a date filter inside each card — when the rule is one filter row above everything it
scopes, so every number on the page agrees with every other.

What a row does need is that the tiles **line up**. Ship the CSS: a grid with
`grid-template-rows: auto auto auto auto` and `grid-template-rows: subgrid` on each tile, so
every label, value and change sits on the same line as its neighbours. Without it a longer
label in one card pushes that card's number out of step, which reads as sloppiness before
anyone can say why.

## Typography, with reasons

- **Proportional figures on the value.** `tabular-nums` gives every digit the width of a zero,
  so `1,284` looks loose at display size. Keep tabular for the change, which *is* a column.
- **The hero is the same sans, larger.** A display or serif face reads as decoration that
  wandered in from a marketing page. Exactly one hero per view — two is a tie, and a tie is the
  reader deciding what the page is about.

## The interface

Attributes: `up`, `size`, `no-trend`, `loading`, `error`. Properties: `value`, `change`,
`limit`, `trend`, `polarity`, `tone`, `labels`.

Ship **`refresh()`**, because the numbers live in text nodes: a page that rewrites the value in
place has changed the data invisibly, and watching for that would mean a `MutationObserver` per
tile reading every character.

Ship **no events**. A tile is read, not reported from.

## Verify before calling it done

Keep the tone rules, the fraction, the parsing and the sparkline geometry reachable without a
browser.

- Every variant runs in an iframe with no external request and no overflow.
- **Render it and look at it.**
- With scripting off, label, value and change are all readable.
- `up="bad"` inverts the tone of the same number; `neutral` gives it none; zero has none.
- Every change has an arrow **and** a word, not only a colour.
- No status colour equals any series colour.
- The meter stops at full when the limit is past, and says its condition in words.
- The sparkline's readings survive enhancement; one reading draws nothing.
- Tiles in a row share row lines.
- The hero value is not `tabular-nums`.
- Contrast reaches AA in both themes — and remember `hidden` is an `HTMLElement` property that
  does nothing on an SVG node, so hide SVG parts with the attribute.
