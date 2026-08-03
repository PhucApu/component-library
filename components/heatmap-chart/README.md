# Heatmap Chart

A framework-free Web Component that reads an ordinary HTML table and colours it in: one hue,
five steps, and a scale legend that is never optional.

No React, no TypeScript, no Tailwind runtime, no charting library, no build step, no network.

## Colour here carries size, not identity

Every other chart in this collection uses colour to say *which* — which series, which source.
This one uses it to say *how much*, and the rules are close to the opposite:

| | Identity (bar, line, donut) | Magnitude (this) |
|---|---|---|
| Hues | Eight, in a fixed order | **One**, light to dark |
| Legend | Optional for a single series | **Never optional** |
| Adding a class | Fold past eight | **Five is the ceiling** |

A colour meaning "a lot" says nothing until the reader is told how much a lot is. That is why
the scale ships with the chart and cannot be turned off.

## An empty cell and a zero are different things

This is the fault an activity calendar loses most often, and it is invisible in the picture.

| Cell | Means | Drawn as |
|---|---|---|
| Empty | **Outside the range** — a day that has not happened, a cohort that has not aged | No square at all |
| `0` | **Measured**, and there was nothing | The quietest square on the scale |
| `> 0` | One of five steps | Along the ramp |

Collapsing the two makes a calendar say "nobody worked" about a month nobody has reached yet.

## The markup

```html
<ui-heatmap-chart>
  <table>
    <caption>Sessions by hour</caption>
    <thead>
      <tr><th></th><th scope="col">00</th><th scope="col">03</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Mon</th><td data-value="12">12</td><td></td></tr>
    </tbody>
  </table>
</ui-heatmap-chart>
```

Of every chart here this is the one the table contract fits best, because the two are the same
shape: row headings become the row labels, column headings the column labels, and each cell a
square. The first heading sits above the row labels and names nothing on the grid.

## No numbers in the squares

A heatmap with a figure in every cell is a table. Printing one would also mean choosing the
ink per step, since the same grey cannot sit on both ends of a ramp.

The value is reachable three other ways: the read-out on hover, the announcement on keyboard,
and the table itself.

## Five steps, and that is a ceiling

Past about seven classes the neighbouring steps blur and the reader is back to consulting the
legend for every cell — which is the thing a colour scale exists to avoid.

Measured against this component's own surfaces:

| | Light `#ffffff` | Dark `#171a20` |
|---|---|---|
| Lightness | Monotonic, darker is more | Monotonic, **brighter** is more |
| Closest neighbouring pair | `1.36` | `1.42` |
| Lowest step against a zero cell | `1.36` | `1.51` |
| The two ends of the scale | `4.31` | `4.70` |

The ramp runs the other way in dark mode on purpose: more-is-darker there would sink the
busiest cells into the background.

## Equal slices, or equal counts

| `scale` | Divides by | Use when |
|---|---|---|
| `linear` (default) | Equal slices of the range | Almost always. A colour means the same quantity wherever it appears |
| `quantile` | Equal numbers of cells | One cell is a hundred times the rest and a linear scale has flattened everything else into step one |

`quantile` has a real cost: two cells of the same colour may be ten apart or ten thousand. The
grid says so underneath itself whenever it is on.

`max` pins the top of the scale, so two grids side by side use the same colours for the same
numbers. Without it each scales to its own busiest cell, which is a comparison that quietly
lies.

## Reading a cell

Point at one, or tab to the grid and use the four arrow keys — a grid has two directions.
`Home` and `End` go to the first and last readable cell, `Escape` lets go.

The grid is **one** tab stop. Cells outside the range are stepped over rather than landed on:
there is nothing to read there, and a keyboard that stops on holes feels broken.

The cell being read is **ringed, not recoloured** — its colour is its value, and changing it
would be changing the reading.

## Attributes, properties, methods

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `scale` | `linear` `quantile` | `linear` | How the steps are cut |
| `max` | number | the busiest cell | Pins the top of the scale |
| `cell` | any CSS length | `1rem` | The size of a square |
| `loading` | present | absent | Hold the grid at reduced opacity |
| `error` | string | — | Say what went wrong; the table stays |

| Member | Notes |
|---|---|
| `columns` · `rows` | What was read from the table |
| `thresholds` | Where one step ends and the next begins |
| `scale` | Resolved, not raw |
| `refresh()` | Re-read the table after the page rewrites it |
| `labels` | Overrides every generated string |

## Accessibility

- **The table is the accessible content.** The grid is `aria-hidden` in its entirety —
  exposing both would read every figure twice, once as a field of squares and once as the
  table it came from, and the table is much the better reading.
- Keyboard reading is announced through a `role="status"` region present and empty beforehand.
- Each swatch in the scale is named with the range it covers.
- Nothing is carried by colour alone: every value is in the table.

## Reduced motion

`prefers-reduced-motion: reduce` removes the ring's fade. Nothing else here moves.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `light-dark()`,
`color-mix()`, and CSS grid.

## Files

| Path | Contents |
|---|---|
| `heatmap-chart.html` | Runnable example |
| `heatmap-chart.css` | Every style, including the validated scale |
| `heatmap-chart.js` | The binning, the custom element, and the demo bootstrap |
