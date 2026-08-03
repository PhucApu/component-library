# Heatmap Chart - Design Specification

## 1. Purpose

A grid where colour carries magnitude: an activity calendar, a cohort retention triangle, load
by hour and weekday. The shapes an admin dashboard reaches for when the question is *where is
it concentrated* rather than *how much in total*.

## 2. A different colour problem from the three before it

`cartesian-chart`, `stat-tile` and `donut-chart` all use colour for **identity**. This one uses
it for **size**, and almost every rule inverts:

| | Identity | Magnitude |
|---|---|---|
| Hues | Eight in a fixed order, chosen so neighbours stay apart | **One**, stepped light to dark |
| Legend | Droppable for a single series | **Never droppable** |
| Too many classes | Fold past eight | **Five is the ceiling** |
| Order of the slots | The safety mechanism | Meaningless — lightness is the mechanism |

Measured against this component's own surfaces:

```text
light #ffffff                        dark #171a20
monotonic lightness  PASS (darker)   monotonic lightness  PASS (brighter)
closest neighbours   1.36            closest neighbours   1.42
lowest step vs zero  1.36            lowest step vs zero  1.51
end to end           4.31            end to end           4.70
```

**The ramp runs the other way in dark mode.** More-is-darker on a dark surface sinks the
busiest cells into the background, which inverts the reading of the whole grid.

The dark set was re-picked once: the first candidate put steps 3 and 4 only `1.21` apart. Even
spacing along the ramp — 650, 550, 450, 350, 250 — moved the weakest pair to `1.42`.

## 3. Empty is not zero

The one fault worth building the whole data model around, because it is invisible in the
output and survives for years:

| Cell | Means | Drawn |
|---|---|---|
| Empty | Outside the range | **No square** |
| `0` | Measured, and nothing happened | The quietest step |

A calendar that collapses them says "nobody worked" about a month nobody has reached yet, and
a cohort grid loses the staircase that shows which rows are still in progress. `parseValue`
returns `null` for empty and `0` for a written zero, and `binFor` keeps them apart all the way
to the square.

## 4. Five steps, and no numbers in them

Past about seven classes the neighbouring steps blur and the reader consults the legend for
every cell — which is what a colour scale exists to prevent.

A figure in every square would make the grid a table, and would also mean choosing the ink per
step, since one grey cannot sit on both ends of a ramp. The value is reachable three other
ways: the read-out, the announcement, and the table.

## 5. Linear by default, rank-based on request

Equal slices of the range is the honest default: a colour means the same quantity wherever it
appears.

Rank-based steps are for a grid one cell dominates — one endpoint at four hundred against a
field of single digits flattens every other cell into step one, and the picture says nothing.
The cost is that the colour stops meaning a fixed amount, so **the grid says so underneath
itself** whenever it is on. That note is not decoration: a reader who assumes a linear scale
reads a quantile grid backwards.

`max` pins the ceiling so two grids agree. Without it each scales to its own busiest cell, and
two retention charts side by side use the same colours for different numbers.

## 6. The grid is a picture; the table is the content

The whole grid carries `aria-hidden="true"`. Exposing the cells as well would read every
figure twice — once as a field of squares and once as the table it was drawn from — and the
table is much the better of the two readings.

That decision cascaded into the markup: the cells are `<span>`s rather than `<button>`s.
A focusable element inside an `aria-hidden` subtree is a trap for anyone arriving by keyboard,
so nothing inside the grid is focusable at all. The frame is the single tab stop, the arrows
move within it, and a `role="status"` region says what was landed on.

## 7. Four arrows, and the holes are stepped over

A grid has two directions, so it takes four keys. Cells outside the range are skipped rather
than landed on: there is nothing to read there, and a keyboard that stops on holes feels
broken. On a cohort triangle that is most of the top-right corner.

The cell being read is **ringed, not recoloured**. Its colour is its value; changing it would
be changing the reading. The ring is reserved as a transparent outline rather than added on
hover, so a cell never grows and shifts its neighbours.

## 8. Variants

| Variant | Teaches |
|---|---|
| Default | Colour as size, five steps, no numbers in the squares |
| Calendar | A quiet day against a day that has not happened |
| Cohort | The triangle, long row names, and a pinned ceiling |
| Scale | Equal slices against equal counts, and what each costs |
| Table | The data contract, and why this chart needs its table most |
| States | Nothing at all, every reading zero, one cell, refetching, a failure |

## 9. Tokens

| Token | Role |
|---|---|
| `--heat-step-0` … `-5` | A measured zero, then the five validated steps |
| `--heat-surface`, `--heat-ink`, `--heat-ink-soft`, `--heat-ink-muted`, `--heat-border` | Surface and ink |
| `--heat-cell`, `--heat-gap`, `--heat-radius` | The grid |
| `--heat-focus`, `--heat-motion` | |
| `--cell-colour` | Written by the element onto a square or a swatch |

## 10. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Calendar variant. Every square
was **placed by this component's own binning** rather than by eye, so the miniature is the same
arithmetic as the real thing — including the two missing squares in the bottom-right corner.
No animation, script, external asset, or embedded raster image.

## 11. Acceptance criteria

- All six variants run independently in an iframe with **no external request** and no overflow.
- With scripting disabled every variant is a complete, readable table.
- An empty cell draws no square; a written zero draws the quietest one.
- The scale legend is present whenever there is a scale, and absent when there is nothing
  above zero to scale.
- Never more than five steps plus the zero swatch.
- No number is printed inside a square.
- `max` pins the top of the scale; `quantile` produces different edges from `linear` on skewed
  data and says so in a note.
- The grid is `aria-hidden` and contains nothing focusable.
- Four arrow keys walk the grid, holes are stepped over, and the reading is announced.
- The cell being read is ringed rather than recoloured.
- A wide grid scrolls inside its own box rather than pushing the page.
- Contrast reaches AA for every word in both themes.
