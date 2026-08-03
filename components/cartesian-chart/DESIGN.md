# Cartesian Chart - Design Specification

## 1. Purpose

The two charts every admin dashboard has: a trend over time and a comparison across
categories. Line, area, column and horizontal bar, grouped or stacked, in one element,
because all four share the same scales, axes, grid, legend and read-out. Splitting them into
separate components would have meant four copies of that machinery, since this collection
requires every distributable file to live inside its own component directory.

## 2. The table is the whole data contract

The markup an author writes is an ordinary `<table>`. That decision is the spine of this
component, and it pays for itself three times:

| It is | Because |
|---|---|
| The **fallback** | With no script the page is every number, readable and complete |
| The **accessible twin** | A chart is supposed to have a table equivalent; here it cannot drift, it is the source |
| The **contrast relief** | Three light-theme slots sit below `3:1` on white by design, which is only allowed where the values read without colour |

The third one is why there is no attribute to remove the table. Taking it away would break a
promise the palette is relying on.

### Written for a person, plotted as a number

`$4,200` is what a reader wants and `4200` is what a scale wants. The parser strips currency,
separators and percent signs, and reads an accounting negative — `(890)` — which carries no
minus sign at all. `data-value` wins when present, which is the way out for a decimal comma:
`1.234,56` is one thousand two hundred in half of Europe and one-point-two here, and no
amount of guessing settles it.

The original text is kept as well, so the read-out shows the value the way it was written
rather than a reformatted version of the same number.

### An empty cell is missing, not zero

Zero says "we sold nothing"; empty says "we did not measure". A line breaks across the gap
rather than diving to the baseline and inventing a month. A stacked segment adds nothing to
its running total rather than keeping the column's height while the band silently vanishes —
the same lie, only harder to see.

## 3. What the component refuses to do

Three refusals, each with a live alternative rather than a shrug.

**No second value axis, and no API for one.** Two scales on one plot invent a correlation the
data does not have: where the lines appear to cross depends entirely on how the second axis
was aligned, and that is a choice the author made rather than something the numbers say. Two
measures of different size are two charts, or one chart with both indexed to a common base.

**No bar that starts anywhere but zero.** A bar is read by its length, so a column chart
floored at 200 makes 220 look like nothing and 410 look like double what it is. `y-min` can
pull the floor further down and cannot lift it off zero. A line is read by its shape and is
free to be pinned wherever the author likes.

**No ninth colour.** There are eight categorical slots. A generated ninth is indistinguishable
from one already on screen under colour-vision simulation, so it would be a lie told in
colour. The ninth series onward is not drawn and a note says the table holds it.
`fold-others` sums the tail into one `Other` instead — which changes what the author wrote,
so it has to be asked for rather than happening to them.

## 4. Colour, measured rather than chosen

The eight slots are the validated reference order. **The order is the safety mechanism**: it
was picked because each neighbouring pair stays apart under simulation, not because it looks
pleasant. Run against this component's own surfaces rather than the palette's defaults, since
contrast is only meaningful against the surface the chart actually renders on:

```text
Light, surface #ffffff        Dark, surface #171a20
[PASS] lightness band          [PASS] lightness band
[PASS] chroma floor            [PASS] chroma floor
[PASS] CVD separation 9.1      [PASS] CVD separation 8.4
[PASS] normal vision  19.6     [PASS] normal vision  19.3
[WARN] 3 slots below 3:1       [PASS] contrast vs surface
```

The light-mode WARN is not dismissable — it obligates visible labels or a table view. The
table is already mandatory here, so the relief was in place before the warning was.

Two consequences that show up as tests rather than as prose:

- **Colour follows the entity, never its rank.** A series is bound to the column it was
  written in, so hiding one never repaints the survivors.
- **One series means one colour for every bar.** Shading bars darker where they are taller
  double-encodes the length, spends the only free channel on information already on screen,
  and makes unordered categories look ordered.

## 5. Marks, and the two spacers

Fixed specs: bars capped at `24px`, lines `2px`, markers `8px`, area fills at `10%`, grid and
axis a solid `1px` hairline one step off the surface. Never dashed — dashing reads as a
threshold when it is only a grid.

Two pixels of the **surface** separate every touching mark, taken out of the mark rather than
drawn on top of it, so the segments of a stack still add up to their own total. Markers carry
a `2px` ring of the same surface so they stay legible where they cross a line. **Never a
stroke around a mark**: that is ink with the weight of data doing a spacer's job.

### The corner that had to be a path

A `<rect rx="4">` rounds all four corners. Drawn that way the first stacked chart came out as
a column of separate pills, and every bar was lifted off the very zero it was measured from.
Bars are built from a path with two rounded corners at the data end and two square ones at
the baseline, and in a stack only the outermost segment is rounded at all.

## 6. Labels

A legend for two series or more and none at all for one: with one colour the caption already
says what is plotted, and a box holding one swatch restates the title.

Direct labels are selective — the end of a line, the cap of a bar when there is a single
series. A number beside every point is chaos and goes unread.

**A label is measured before it is placed and dropped rather than clipped.** The right inset
is widened to hold the end-of-line labels *before* the plot is sized; sizing the plot first
and then discovering the label does not fit is how a chart ends up with its most useful
number quietly missing. If it still will not fit, it goes and the read-out and table keep it.

Text never wears the data colour. A light categorical hue is illegible as text on the
surface, and identity comes from the coloured mark beside the words.

## 7. Reading a value

A crosshair finds the category on a line or area and **one read-out lists every series
there** — the pointer never has to land on a stroke. On bars each mark is its own target and
lifts while it is read.

The keyboard walks the same positions and produces exactly the same content, announced
through a `role="status"` region that is present and empty beforehand. A value only a mouse
can reach is a value half the room cannot. Nothing is gated behind the read-out: every number
is in the table, without hovering at all.

## 8. Measured layout

Insets are measured, not guessed. The widest tick label decides the left edge; the category
labels decide the bottom; the end-of-line labels decide the right. A guessed inset is clipped
at one size and swimming in space at another.

The chart is redrawn at the size it is given rather than scaled by a `viewBox`, because
scaling an SVG stretches its text with it — an axis label squeezed to 82% of its width is the
clearest sign nobody looked at the chart on a narrow screen.

Category labels are **thinned** when they stop fitting, never rotated: a rotated label is
slower to read, and on a narrow screen the axis ends up taller than the plot. The last
category is always kept, because on a time axis that is the one a reader looks for first.

The frame's height includes the axis band, so the card never grows a nested scrollbar.

## 9. Faults found while building it, and what they cost

| Fault | How it showed up |
|---|---|
| `hidden` set as a **property** on an SVG node | `Element.hidden` is defined on `HTMLElement` and does nothing on SVG, so the crosshair sat parked at `x=0` down the left of every chart. Visible in the first screenshot, invisible to any assertion that only asked whether the property was true |
| End labels never drawn | Measured against the edge of the *plot* rather than the edge of the *frame* — so the inset was reserved for them and then left empty |
| Axis title one pixel above the frame | A 12px label reports a 16px line box, so a baseline at 12 puts its top at −1. Measured rather than nudged |
| `rx` on a bar | Rounded all four corners, lifting every bar off zero |
| The colour variable built by concatenation | `--chart-series-${n}` exists only at run time, so nothing can check the component defines it. The repository's own validator said so; eight literals replaced it |
| An eleven-column table hidden with `overflow: hidden` | A table cannot be squeezed below its own min-content width, so `inline-size: 1px` clipped it invisibly and still pushed an 819px scrollbar onto a 360px page. Wrapped in a block instead |
| The read-out rebuilt on every pointer report | See §9a |

## 9a. Following the pointer, measured

Hovering felt like it was catching, so it was measured rather than guessed at. One slow sweep
across a plot with **eight** categories:

```text
before                       after
reads      121               reads      8
rebuilds   483               rebuilds   31
```

The pointer reports about a hundred times across the plot, and every single report was
answered: the panel's children were torn down and built again — 483 times for 8 distinct
values — and each rebuild called `getBoundingClientRect()` on itself to work out where to
sit, forcing a layout, and dispatched an event that made the demo rewrite its own output.

Three changes, in order of how much they were worth:

- **Answer only when the answer changes.** The snapped category is computed at most once per
  animation frame, and nothing else runs unless it differs from the last one. One read per
  category is the floor, and that is now what it costs.
- **Move by `transform`, not by `inset`.** `inset-inline-start` is a layout property: writing
  it lays the panel out again, and — the part that actually showed — it cannot be
  transitioned, so the panel *jumped* from one category to the next. A translate is
  composited and glides. The measured `transition-property` was `all` before, which sounds
  like everything and animates nothing without a duration.
- **Let the marks answer too.** A ring rides the crosshair on each line. Without it only a
  box floats about beside a chart that looks inert.

The glide is `130ms` and goes to zero under `prefers-reduced-motion` — a transition is motion
whatever it is carrying.

## 10. Variants

| Variant | Teaches |
|---|---|
| Default | The line chart, the legend, the crosshair reading every series at once |
| Bars | Columns and horizontal bars, one series in one colour, the zero floor |
| Stacked | Part-to-whole over time, the surface gap, a missing week |
| Scales | Round ticks, a pinned range, thinned labels, and why there is no second axis |
| Interaction | Crosshair, keyboard parity, a legend that never repaints the survivors |
| Table | The data contract, `data-value`, the no-script fallback |
| States | One series, nothing at all, refetching, a failure, the ninth colour |

## 11. Tokens

| Token | Role |
|---|---|
| `--chart-series-1` … `-8` | The validated categorical slots, as `light-dark()` pairs |
| `--chart-surface`, `--chart-ink`, `--chart-ink-soft`, `--chart-ink-muted` | Surface and the three inks |
| `--chart-grid`, `--chart-axis`, `--chart-border` | Chrome, all one step off the surface |
| `--chart-focus`, `--chart-radius`, `--chart-height` | The frame |
| `--chart-area-opacity`, `--chart-gap`, `--chart-motion` | The wash, the spacer, the one-pass draw-in |
| `--mark-colour` | Written by the element onto a mark, swatch or key |

## 12. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant: two lines,
solid hairline grid, a legend keyed with strokes rather than boxes, and a label at the end of
each line only. No animation, script, external asset, or embedded raster image.

## 13. Acceptance criteria

- All seven variants run independently in an iframe with **no external request** and no
  overflow.
- With scripting disabled every variant is a complete, readable table of numbers.
- No second value axis exists anywhere in the rendered output.
- Columns and bars start at zero; `y-min` above zero does not lift the floor.
- A single-series bar chart paints every bar the same colour.
- Hiding a series through the legend leaves every survivor's colour unchanged.
- Gridlines are solid, never dashed.
- No label is clipped by the frame; one that will not fit is absent instead.
- The frame's height includes the axis band, and the component does not scroll.
- Two or more series show a legend; one series shows no legend box.
- The keyboard produces the same read-out as hover, and every value in the read-out is in the
  table.
- An empty cell breaks the line rather than plotting zero.
- The table is present in the page whether shown or collapsed.
- Following the pointer costs one read per category, not one per pointer report.
- The read-out and the crosshair move by `transform`, with a duration, and both go still
  under reduced motion.
