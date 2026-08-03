# Cartesian Chart

A framework-free Web Component that reads an ordinary HTML table and draws it as a line, area,
column or horizontal bar chart.

No React, no TypeScript, no Tailwind runtime, no charting library, no build step, and no
network. The whole thing is SVG written by hand from numbers already on the page.

## The markup is the data

```html
<ui-cartesian-chart type="line">
  <table>
    <caption>Revenue by month</caption>
    <thead>
      <tr><th scope="col">Month</th><th scope="col">Online</th><th scope="col">Retail</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Jan</th><td data-value="4200">$4,200</td><td>3,100</td></tr>
      <tr><th scope="row">Feb</th><td data-value="5100">$5,100</td><td></td></tr>
    </tbody>
  </table>
</ui-cartesian-chart>
```

| | |
|---|---|
| First column | The category, one per row |
| Every column after it | One series, named by its `<th>` |
| Value plotted | `data-value` if present, otherwise the cell text parsed |
| Empty cell | **Missing**, not zero |

That one table does three jobs that are usually three separate pieces of work:

- **The fallback.** With no script the page is a complete, readable table of numbers rather
  than an empty box where a chart was going to be.
- **The accessible twin.** Every chart is supposed to have a table equivalent. Here it is not
  a copy that can drift out of step — it is the source.
- **The contrast relief.** Three of the eight light-theme series colours sit below `3:1` on
  white by design. That is allowed only where the values are readable without colour as well.

Which is why **the table can be hidden but not removed.** There is no attribute for it.

### Written for a person, plotted as a number

A cell says `$4,200`, `1 234`, `12%` or `(890)` and the chart plots `4200`, `1234`, `12` and
`-890`. Where the text cannot be parsed with confidence — a decimal comma above all —
`data-value` settles it and the cell goes on reading however it was written. The read-out
shows the author's own wording rather than a reformatted version of the same number.

### An empty cell is missing, not zero

Zero says "we sold nothing". Empty says "we did not measure". A line breaks across a gap
rather than diving to the baseline, and a stacked segment adds nothing to its total rather
than silently vanishing while the column keeps its height.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `type` | `line` `area` `column` `bar` | `line` | Which mark to draw. `bar` is horizontal |
| `stacked` | present | absent | Stack the series (`column`, `bar`, `area`) |
| `y-min` / `y-max` | number | automatic | Pin the value scale |
| `x-label` / `y-label` | string | — | Name an axis |
| `no-legend` | present | absent | For a page that supplies its own identity channel |
| `no-labels` | present | absent | Drop the direct labels; the read-out and table still have them |
| `fold-others` | present | absent | Sum the ninth series onward into one `Other` |
| `loading` | present | absent | Hold the previous render at reduced opacity |
| `error` | string | — | Replace the plot with this message; the table stays |

## Properties, methods, events

| Member | Notes |
|---|---|
| `categories` | Every category, in row order |
| `series` | Every series, with its values |
| `visible` | The series currently drawn |
| `type` / `stacked` | Resolved, not raw |
| `showSeries(i)` / `hideSeries(i)` | The same thing the legend does |
| `labels` | Overrides every generated string |

| Event | Detail |
|---|---|
| `chart-read` | `{ index, category, values: [{ name, value, text }] }` |
| `chart-series-toggle` | `{ index, name, hidden }` |

## There is no second value axis

There is no attribute for one and no way to add one. Two scales on a single plot invent a
correlation the data does not have: where the two lines appear to cross depends entirely on
how the second axis was aligned, and that alignment is a choice made by whoever drew the
chart rather than something the numbers say.

Two measures of different size are **two charts**, or one chart with both indexed to a common
base at the first period — which puts them on one honest scale.

## Colour

Eight categorical slots, and **the order they sit in is the safety mechanism, not a
preference**: it was chosen so that every neighbouring pair stays apart for a reader with
colour blindness. Measured against this component's own two surfaces with a palette
validator:

| | Light on `#ffffff` | Dark on `#171a20` |
|---|---|---|
| Worst adjacent pair, simulated CVD | `9.1` (floor 8) | `8.4` |
| Worst adjacent pair, normal vision | `19.6` (floor 15) | `19.3` |
| Contrast against the surface | 3 slots below `3:1` — relief is the table | all clear `3:1` |

Two rules follow from that and are worth knowing before you change anything:

- **Colour follows the entity, never its rank.** A series keeps the colour its column earned,
  so hiding one never repaints the others. A reader who learned that orange means Retail gets
  to keep it.
- **There is no ninth colour.** A generated ninth is indistinguishable from one already on
  screen under simulation, so the ninth series onward is not drawn and a note says where to
  find it. `fold-others` sums the tail into one `Other` instead — which changes what you
  wrote, so it is something to ask for rather than something that happens to you.

One more, for bar charts specifically: **one series means one colour for every bar.** Shading
bars darker where they are taller spends the only free channel the chart has on information
the bar's own length already carries, and makes unordered categories look ordered.

## Marks

| Mark | Spec |
|---|---|
| Column / bar | `≤ 24px` thick, rounded `4px` at the data end, **square at the baseline** |
| Line | `2px`, round join and cap |
| Marker | `8px`, with a `2px` ring in the surface colour |
| Area | The series hue at `10%` — a wash, never a block |
| Grid and axis | `1px`, **solid**, one step off the surface |

Two pixels of the surface separate every touching mark — each segment of a stack, each
adjacent bar. It is taken out of the mark rather than drawn on top, so the segments still add
up to their own total. **Never a stroke around a mark**: that is ink with the weight of data
doing a spacer's job.

Columns and bars always include zero and `y-min` can only pull the floor further down. A bar
is read by its length, so a bar chart starting at 200 makes 220 look like nothing. A line is
read by its shape and carries no such obligation.

## Labels

A **legend for two series or more, and none at all for one** — with one colour the caption
already says what is plotted, and a box holding a single swatch restates the title.

Direct labels are selective: the end of each line, the cap of each bar when there is only one
series. A number beside every point is chaos and goes unread. **A label that will not fit is
dropped, never clipped or shrunk** — the read-out and the table still have the value.

Text never wears the data colour. A light categorical hue is illegible as text; identity comes
from the coloured mark beside the words.

## Reading a value

| Type | How |
|---|---|
| `line` `area` | A hairline follows the pointer and snaps to the nearest category. **One read-out lists every series there** |
| `column` `bar` | Each mark is its own target and lifts while it is read |

Nobody has to land on a two-pixel stroke: the thing being aimed at is a date.

The marks being read answer as well as the panel — a ring rides the crosshair on each line,
and bars lift. And the panel **glides** from one category to the next rather than jumping:
it is moved by `transform`, which can be transitioned and is composited, where
`inset-inline-start` is a layout property that can be neither.

Nothing is recomputed while the answer has not changed. A pointer reports about a hundred
times across a plot with eight categories in it; the chart answers once per category.

| Key | While the chart has focus |
|---|---|
| `←` `→` `↑` `↓` | Walk the categories |
| `Home` `End` | The first and the last |
| `Escape` | Let go |

**Focus shows exactly what hover shows.** A value only a mouse can reach is a value half the
room cannot. And nothing is gated behind the read-out — every number is in the table.

## States

Default, hover, focus-visible, and:

- **`loading`** holds the previous render at reduced opacity. A skeleton would throw away a
  shape the reader is still looking at and flash the layout for something about to look
  almost the same.
- **`error`** replaces the plot with the message and leaves the table where it was, so the
  numbers that did arrive are still readable.
- **Empty** says so in words rather than drawing an axis with nothing on it.

## Responsive

Redrawn at the size it is given rather than scaled by a `viewBox`, because scaling an SVG
stretches its text with it. When category labels stop fitting they are **thinned** — every
second, every third — and the last one is always kept, since on a time axis that is the one a
reader looks for first. They are never turned on their side: a rotated label is slower to
read, and on a narrow screen the axis ends up taller than the plot. Long category names are
usually a sign the chart wants `type="bar"`.

The frame's height includes the axis band, so a chart card never grows a nested scrollbar.

## Accessibility

- The table is the accessible content; the drawing is `aria-hidden`. Collapsed, the table is
  visually hidden and still in the page, so a screen reader has every number.
- Walking the chart with the keyboard announces the same read-out through a `role="status"`
  region that is present and empty beforehand.
- A hidden series is struck through as well as faded, so its state does not rest on colour.
- The last visible series will not switch off — an empty plot under a full legend reads as a
  fault rather than as a choice.

## Reduced motion

`prefers-reduced-motion: reduce` removes the one-pass draw-in entirely, and the glide with
it. The chart is there rather than arriving, and the read-out is at the next category rather
than travelling to it.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `light-dark()`,
`color-mix()`, `ResizeObserver` and inline SVG.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

Without a server the table is still a table.

## Files

| Path | Contents |
|---|---|
| `cartesian-chart.html` | Runnable example |
| `cartesian-chart.css` | Every style, including the eight validated slots |
| `cartesian-chart.js` | The scales and geometry, the custom element, and the demo bootstrap |
