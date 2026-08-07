# Funnel Chart

A framework-free Web Component that reads an ordinary HTML table and draws an ordered sequence
of stages as bars from a shared baseline — not as a tapering trapezoid.

No React, no TypeScript, no Tailwind runtime, no charting library, no build step, no network.

## The familiar shape is the problem

The tapering funnel encodes the value as a **width** and then hands the eye an **area** to
read. The area of a trapezoid is not proportional to the number it stands for, so every drop
comes out looking worse than it was — always in the same direction.

Bars from a shared left edge put the value in a **length**, which is the one visual channel
people compare accurately. You lose the shape. You gain a chart that says what happened.

## One colour, and the loss gets the ink

Vertical position already carries the order. Bar length already carries the value. Shading each
stage a different depth would spend the only free channel restating the order.

So colour goes to the thing nothing else shows: **the people who left.** Each drop is drawn as
a shaded run starting exactly where its bar ends and finishing exactly where the previous bar
did, and the largest one is marked — in words as well as colour.

## The markup

```html
<ui-funnel-chart>
  <table>
    <caption>Checkout funnel</caption>
    <thead>
      <tr><th scope="col">Stage</th><th scope="col">People</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Viewed product</th><td data-value="18400">18,400</td></tr>
      <tr><th scope="row">Added to cart</th><td data-value="6200">6,200</td></tr>
    </tbody>
  </table>
</ui-funnel-chart>
```

Row order **is** stage order. Nothing is sorted — a funnel sorted by size is no longer a funnel,
it is a bar chart that threw away the sequence.

`data-value` settles anything ambiguous, so a cell can read `1.2k` for a person while the chart
gets `1200`. Only the first value column is plotted; a second one is left alone.

## Two rates, because there are two questions

| | Means | Finds |
|---|---|---|
| **Of previous** | Of those who reached this stage, how many went on | The broken step |
| **Of the top** | Of everyone who entered, how many got this far | The number you report |

Printing only one is the commonest fault in the form. With just the from-the-top rate, a bad
step hides behind every loss above it; with just the step rate, you never reach the number the
business earns.

The second stage prints only one, because there the previous stage *is* the top and both rates
are the same figure.

**The absolute loss is always printed.** A rate is something you have to turn back into people
before you can argue about it; `12,200 lost` already is the sentence.

## The largest drop is found by count

Not by rate. The worst rate is usually the last step of a long funnel, where a handful of people
are left and losing three of them reads as a catastrophe. The worst count is where the work is.

## A stage that grew is not a funnel

More people at step four than at step three describes a shape that cannot exist. Rather than
drawing a bar longer than the one it came from, the chart names the stage and says what usually
causes it — stages measured over different windows, or people joining part-way through.

## Comparing two funnels

Left to itself each funnel scales to its own tallest stage, so 6,900 draws the same full-width
top bar as 18,400 and every pair of bars below invites a comparison that is not there.

`max` pins the ceiling so both share one ruler. The rates never move — a shape can mislead while
every number beside it stays true.

## Colour, measured

Against this component's own two surfaces, on exact ratios:

| | Floor | Light `#ffffff` | Dark `#171a20` |
|---|---|---|---|
| Bar vs surface | `3.0` | `4.4154` | `4.7890` |
| Drop region vs surface | `1.2` | `1.2507` | `1.2462` |
| Drop region vs bar | `2.0` | `3.5303` | `3.8428` |
| Largest drop vs an ordinary one | `1.15` | `1.2059` | `1.2329` |
| Its label on its own fill | `4.5` | `5.1522` | `5.8607` |

### The optional ordinal ramp

`shade="stages"` for the familiar look. Ordinal is a third kind of colour problem: unlike a
sequential ramp, no step may recede toward the surface, because a funnel stage is a bar that
has to be seen rather than a shade of nothing.

| | Floor | Light | Dark |
|---|---|---|---|
| Worst step vs surface | `2.0` | `2.1103` | `2.1503` |
| Worst neighbouring pair | `1.2` | `1.4152` | `1.3508` |

Six steps. Past six the ramp falls back to one colour and says so — nothing is discarded,
because summing two stages of a funnel would be meaningless.

## Reading a stage

Point at one, or tab to the funnel and use **up and down** — a funnel has one direction, so
offering left and right would invite you to look for something sideways that is not there.
`Home` and `End` reach the ends, `Escape` lets go, and neither end wraps.

## Attributes, properties, methods

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `max` | number | the tallest stage | Pins the ceiling so two funnels share one ruler |
| `shade` | `single` `stages` | `single` | One colour, or the six-step ordinal ramp |
| `rates` | `both` `step` `top` | `both` | Which rates are printed |
| `loading` | present | absent | Hold the bars at reduced opacity |
| `error` | string | — | Say what went wrong; the table stays |

| Member | Notes |
|---|---|
| `stages` | Every stage with both rates, its loss, and its share of the track |
| `overall` | First stage to last, or `null` when there is nothing to divide |
| `largestDrop` | The stage that lost the most people, or `null` |
| `shade` · `rates` | Resolved, not raw |
| `refresh()` | Re-read the table after the page rewrites it |
| `labels` | Overrides every generated string |

## Accessibility

- **The table is the accessible content.** The bar list is `aria-hidden` in its entirety —
  every word in it is already in the table or in the summary, so exposing both would read the
  funnel twice.
- **The summary line is visible, not screen-reader-only.** The overall rate and the worst step
  are computed, so they are in neither the table nor the bars; a sighted reader should not have
  to derive them either.
- Nothing inside the `aria-hidden` list is focusable — a focusable element in an `aria-hidden`
  subtree is a trap. The frame is the single tab stop.
- Keyboard reading is announced through a `role="status"` region present and empty beforehand.
- Nothing is carried by colour alone: the largest drop is a word, and every value is in the
  table.

## Reduced motion

`prefers-reduced-motion: reduce` removes the bar's width transition and the row tint's fade.
Nothing else here moves.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `light-dark()`, `color-mix()`,
CSS grid, and logical properties.

## Files

| Path | Contents |
|---|---|
| `funnel-chart.html` | Runnable example |
| `funnel-chart.css` | Every style, including the measured palette |
| `funnel-chart.js` | The rate arithmetic, the custom element, and the demo bootstrap |
