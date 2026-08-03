# Stat Tile - Design Specification

## 1. Purpose

The row of headline numbers at the top of an admin dashboard — the surface most looked at and
least designed. A value, what it changed by, and enough context to know whether that matters.

## 2. What it refuses to be

**A one-bar bar chart.** A single current value drawn with an axis, a grid and a legend spends
three pieces of chrome saying what the number already said. **A two-slice pie.** A ratio
against a limit is a meter; two slices of a circle is the hardest possible way to read one
percentage.

Both are in the catalogue of things that go wrong precisely because they look like
thoroughness.

## 3. Inherited, not re-decided

The validated eight-slot palette, the `light-dark()` token pattern, the reduced-motion rule
and the "markup is the data" contract all come from `cartesian-chart`. This component adds one
thing to the colour system: the **reserved status palette**, which is never a series colour
and never borrowed by one. A hue that means *critical* cannot also mean *the third product
line*.

## 4. The direction is a fact; the judgement is the author's

Costs rising twelve per cent and revenue rising twelve per cent are the same arrow and
opposite news. `deltaDirection` reads the sign; `deltaTone` combines it with `up`, which the
author sets. `neutral` reports the direction and declines to judge it — headcount going up is
neither, and colouring it green says otherwise.

Zero is not a small rise. It shows no arrow and says `no change`: a flat arrow or a zero in
green both suggest something happened.

### Three signals, in order of reliability

Arrow, word, colour. The colour is last on purpose:

- it survives a grey-scale print-out,
- it survives the reader who cannot separate red from green,
- and it is what makes the light-theme status inks legal at all.

Measured against the two surfaces, as text (so held to `4.5:1`, not the `3:1` a mark needs):

| | Light `#ffffff` | Dark `#171a20` |
|---|---|---|
| good | `#006300` — 7.54 | `#0ca30c` — 5.19 |
| bad | `#d03b3b` — 4.80 | `#f08a86` — 7.21 |

Neither the light green nor the dark red is the status *fill*. `#0ca30c` reaches only 3.27 on
white and `#d03b3b` only 3.63 on the dark surface — fine for a bar, short for a word.

## 5. The meter, and the one colour that cannot work

The fill carries severity and the track is the fill's own hue mixed into the surface at 12%,
so the whole bar reads as one measurement rather than as two colours meeting. Fill against
track, measured:

| Tone | Light | Dark |
|---|---|---|
| ok | **3.80** | **4.14** |
| critical | **4.03** | **3.31** |
| warning | **1.70** | **7.55** |

Warning on the light surface fails, and **no lighter step of amber can pass** — amber is too
pale to carry a boundary against anything lighter than itself. The palette anticipates exactly
this and prescribes the mitigation: icon and label. So the meter states its condition in words
— *nearing the limit*, *at the limit* — in every state that has one, and nothing depends on
the bar's colour.

That is the honest resolution. The alternative was a grey track, which would have passed the
number and broken the rule the number exists to serve.

A quota already past fills the bar and stops there. A bar drawn beyond its own track has
stopped measuring anything.

## 6. The ceiling is markup, not an attribute

The approved plan had `limit="1000"`. Building it, an attribute turned out to need a second
attribute for its wording — and the component already had a rule for exactly this shape of
problem. So the ceiling became a line of markup like every other number here:

```html
<p class="stat-tile__limit" data-value="1024">of 1 TB</p>
```

One fewer attribute, the wording stays the author's, and the meter turns on because the page
said what the ceiling is rather than because a flag was set.

## 7. The sparkline

No axis, no grid, no labels. It says which way the number has been going; anything else on it
competes with the number it is context for. The line recedes and only the current reading takes
the accent.

A flat run is drawn through the middle rather than along the floor — pinned to the bottom it
reads as "zero" rather than "unchanged". A single reading draws nothing, because one point
cannot show a direction.

Once drawn, the `<ol>` is visually hidden and stays in the page. **No toggle**, unlike
`cartesian-chart`: there the table is the only route to the values, here the value and the
change are on screen already, so twelve readings do not earn a control of their own.

## 8. A row is layout, and that is a decision

There is no `<ui-stat-row>`. A row arranges tiles and adds no meaning — the taxonomy's own
test — and a wrapper element would invite a date filter inside each card, when the rule is one
filter row above everything it scopes so that every number on the page agrees with every
other.

What a row genuinely needs is that the tiles **line up**, which is a real problem and is
solved with `subgrid`: every label, value and change sits on the same line as its neighbours.
Without it a longer label in one card pushes that card's number out of step with the rest,
which reads as sloppiness before anyone can say why. The CSS ships in the variant to be copied.

## 9. Typography with reasons

- **Proportional figures** on the value. `tabular-nums` gives every digit the width of a zero,
  which makes `1,284` look loose at display size. Tabular is for columns that line up, and a
  headline is not a column — the change *is* one, so it keeps tabular.
- **The same sans, larger** for the hero. A display or serif face here reads as decoration
  that wandered in from a marketing page, and it is the one place people reach for one.
- **Never abbreviated by the component.** `$1.28M` is the author's; `1284000` is
  `data-value`'s.

## 10. `refresh()` rather than a watcher

The numbers live in text nodes, so a page that rewrites the value in place has changed the
data invisibly. Observing that would mean a `MutationObserver` per tile watching every
character. One method is the honest interface and a great deal cheaper.

There are no events: a tile is read, not reported from.

## 11. Variants

| Variant | Teaches |
|---|---|
| Default | The three lines, the sparkline, and what the script actually adds |
| Row | Four tiles that line up, four different judgements, the filter row above |
| Delta | Same arrow and opposite news; no change; no delta at all |
| Meter | The ceiling in markup, the same-hue track, and the state in words |
| Hero | The one number a view leads with, and why exactly one |
| States | Refetching, a failure, `no-trend`, and a number nobody has yet |

## 12. Tokens

| Token | Role |
|---|---|
| `--stat-surface`, `--stat-ink`, `--stat-ink-soft`, `--stat-ink-muted`, `--stat-border` | Surface and ink |
| `--stat-good`, `--stat-bad` | Delta ink, held to `4.5:1` |
| `--stat-meter-ok`, `--stat-meter-warning`, `--stat-meter-critical` | Reserved status fills |
| `--stat-accent`, `--stat-spark` | The current reading, and the line behind it |
| `--stat-focus`, `--stat-radius`, `--stat-motion` | |
| `--tone-colour` | Written by the element onto the change and the meter |

## 13. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Row variant: four tiles with
the same arrow meaning three different things, plus two meters. No animation, script, external
asset, or embedded raster image.

## 14. Acceptance criteria

- All six variants run independently in an iframe with **no external request** and no overflow.
- With scripting disabled, the label, the value and the change are all readable.
- `up="bad"` inverts the tone of the same number; `neutral` gives it none.
- A change of zero shows no arrow and says so.
- Every change carries an arrow and a word, not only a colour.
- No status colour equals any series colour.
- The meter fills to its fraction, stops at full when the limit is past, and states its
  condition in words whenever it has one.
- The meter is announced with its minimum, maximum and current value.
- The sparkline's readings remain in the page after enhancement.
- A single reading draws no sparkline.
- Tiles in a row share row lines.
- The hero value does not use `tabular-nums`.
- Contrast reaches AA in both themes.
- Reduced motion removes the meter's transition.
