# Recreate Cartesian Chart

You are a Senior Frontend Engineer. Build a Web Component named `<ui-cartesian-chart>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a charting library, a backend, or a new dependency. Every mark is SVG you write.

## The central instruction

**The data is an ordinary `<table>` in the light DOM, and it stays one.**

```html
<ui-cartesian-chart type="line">
  <table>
    <caption>Revenue by month</caption>
    <thead><tr><th>Month</th><th>Online</th><th>Retail</th></tr></thead>
    <tbody><tr><th>Jan</th><td data-value="4200">$4,200</td><td>3,100</td></tr></tbody>
  </table>
</ui-cartesian-chart>
```

First column the categories, every column after it a series named by its heading. Read it,
keep it, and change nothing about it except adding a colour key beside each heading.

That one table does three jobs at once, and the third is the one people miss:

- **The fallback.** No script leaves a complete, readable table rather than an empty box.
- **The accessible twin.** A chart is supposed to have a table equivalent; make it the source
  so it cannot drift.
- **The contrast relief.** Some light-theme series colours will sit below `3:1` on white. That
  is only allowed where the values are readable without colour as well.

So **ship no attribute that removes the table.** Collapsed it is *visually* hidden and still
in the page, so a screen reader keeps every number while the drawing stays `aria-hidden`.

Support `line`, `area`, `column` and horizontal `bar`, grouped and stacked, in **one**
component. All four share scales, axes, grid, legend and read-out; four components would be
four copies of it.

## Three refusals, each with an alternative

- **No second value axis, and no API for one.** Two scales on one plot invent a correlation
  the data does not have — where the lines appear to cross depends on how the second axis was
  aligned, which is the author's choice rather than the numbers'. Say so in the documentation,
  and give the alternative: two charts, or both series indexed to a common base.
- **No bar that starts anywhere but zero.** A bar is read by its length, so a column chart
  floored at 200 makes 220 look like nothing. Let `y-min` pull the floor down and never up. A
  line is read by its shape and carries no such obligation.
- **No ninth colour.** Eight categorical slots. A generated ninth is indistinguishable from
  one already on screen under colour-vision simulation. Do not draw the tail; say the table
  holds it. Offer `fold-others` to sum it into one `Other`, because summing changes what the
  author wrote and has to be asked for.

## Colour is computed, not chosen

Take a validated categorical palette and **run it against your own two surfaces** — contrast
means nothing against a surface the chart does not render on. The **order of the slots is the
safety mechanism**, not decoration: neighbouring pairs are what have to stay apart. Record the
measured numbers in the design document so the next person cannot quietly re-order them.

- **Colour follows the entity, never its rank.** Bind a series to the column it was written
  in, so hiding one never repaints the survivors. A reader who learned "Retail is orange"
  keeps it.
- **One series means one colour for every bar.** Shading bars darker where they are taller
  double-encodes the length the bar already shows and makes unordered categories look ordered.
- **Do not build the property name.** `--chart-series-${n}` exists only at run time, so
  nothing can verify the component defines it. Write the eight `var()` references out.

## Marks and the two spacers

Bars capped at `24px`, lines `2px`, markers `8px`, area fills at `10%`, grid and axis a solid
`1px` hairline one step off the surface — **never dashed**, which reads as a threshold when it
is only a grid.

- **Two pixels of the surface** separate every touching mark, taken *out of* the mark rather
  than drawn on top, so a stack still adds up to its own total. Markers get a `2px` ring of
  the same surface. **Never a stroke around a mark** — that is data-weight ink doing a
  spacer's job.
- **Build a bar from a path, not `<rect rx>`.** `rx` rounds all four corners: it lifts every
  bar off the zero it is measured from and turns a stack into a column of separate pills. Two
  rounded corners at the data end, two square at the baseline, and in a stack only the
  outermost segment is rounded.

## Labels

A legend for two series or more and **none at all for one** — one colour means the caption
already says what is plotted.

Direct labels are selective: the end of a line, the cap of a bar when there is one series. A
number beside every point is chaos and goes unread.

**Measure a label before you place it, and reserve its room before you size the plot.** Widen
the right inset for the end-of-line labels first; sizing the plot and then discovering the
label does not fit is how a chart loses its most useful number. Measure against the edge of
the **frame**, not the plot — the inset was widened for exactly this. If it still will not
fit, drop it; the read-out and the table have it.

Text never wears the data colour. Identity comes from the coloured mark beside the words.

## Reading a value

A crosshair snaps to the nearest category on line and area, and **one read-out lists every
series there** — nobody should have to land on a two-pixel stroke. On bars each mark is its
own target and lifts while it is read.

The keyboard walks the same positions and **produces exactly the same content**, announced
through a `role="status"` region that is present and empty beforehand. Nothing is gated behind
the read-out: every value is in the table without hovering at all.

## Make following the pointer cost almost nothing

A pointer reports about a hundred times across a plot with eight categories in it. **Answer
only when the answer changes**: compute the snapped category at most once per animation frame
and do nothing at all unless it differs from the last one. Answering every report tore the
panel down and rebuilt it 483 times for 8 distinct values, each rebuild forcing a layout to
position itself — which is exactly what "the hover feels like it catches" is made of.

**Move the panel and the crosshair by `transform`, never by `inset`.** `inset-inline-start` is
a layout property: writing it lays the panel out again, and it cannot be transitioned, so the
panel jumps from one category to the next. Watch for a computed `transition-property` of
`all` — it sounds like everything and animates nothing without a duration.

**Let the marks answer too.** A ring riding the crosshair on each line, and bars that lift.
Without it a box floats about beside a chart that looks inert.

The glide is short — around `130ms` — and goes to zero under `prefers-reduced-motion`. A
transition is motion whatever it is carrying.

## Measure the layout; do not guess it

Insets come from the widest tick label, the category labels and the end labels — measured.
Redraw at the size the element is given rather than scaling a `viewBox`, which stretches text
with it. **Thin** category labels when they stop fitting rather than rotating them, and always
keep the last one. Size the frame to include the axis band so the card never grows a nested
scrollbar.

## Traps this component actually fell into

- **`hidden` is a property of `HTMLElement` and does nothing on an SVG node.** Setting
  `line.hidden = true` left a hairline parked at `x=0` down the left of every chart — obvious
  in a screenshot, invisible to any assertion that only read the property back. Use the
  attribute.
- **A 12px label reports a 16px line box.** A baseline at 12 puts its top one pixel above the
  frame. Measure the overflow rather than nudging until it looks right.
- **An empty cell is missing, not zero**, in stacks as much as in lines.
- Keep a **measuring text node in its own class**, or it answers every query looking for a
  real label.

## Variants

Build seven, each teaching one thing: the line and its crosshair; columns and horizontal bars;
stacked; scales and why there is no second axis; interaction and the legend that does not
repaint; the table contract; and the states — one series, empty, refetching, failed, and the
ninth colour.

## Verify before calling it done

Keep the scales, ticks, stacking, parsing and path geometry reachable without a browser.

- Every variant runs in an iframe with **no external request** and no overflow.
- **Render it and look at it.** The palette validator checks colour, not layout.
- With scripting disabled, every variant is a complete table of numbers.
- No second axis exists in the output.
- Columns start at zero; `y-min` above zero does not lift the floor.
- A single-series bar chart paints every bar one colour.
- **Hiding a series leaves every survivor's colour unchanged.**
- Gridlines are solid.
- **No text is clipped by the frame** — exclude the measuring node from that check or it will
  fail for ever.
- The frame includes the axis band and the component does not scroll.
- Two series show a legend; one shows no legend box.
- **The keyboard read-out equals the hover read-out**, and every value in it is in the table.
- An empty cell breaks the line rather than plotting zero.
