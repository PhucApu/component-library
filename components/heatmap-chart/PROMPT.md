# Recreate Heatmap Chart

You are a Senior Frontend Engineer. Build a Web Component named `<ui-heatmap-chart>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a charting library, a backend, or a new dependency.

## Colour carries size here, and that inverts almost every rule

A bar chart uses colour for identity: eight hues in an order chosen so neighbours stay apart,
and a legend you can sometimes drop. This uses colour for magnitude, so:

- **One hue**, stepped light to dark.
- **Five steps.** Past about seven classes neighbouring steps blur and the reader consults the
  legend for every cell, which is what a colour scale exists to prevent.
- **The legend is never optional.** A colour meaning "a lot" says nothing until the reader is
  told how much a lot is.

Validate the ramp against **your own two surfaces**, and check three things a categorical
validator does not: lightness is monotonic, neighbouring steps are separable, and the lowest
step is separable from a zero cell.

**Run the ramp the other way in dark mode.** More-is-darker on a dark surface sinks the
busiest cells into the background and inverts the reading of the whole grid.

## Empty is not zero, and this is the fault to design around

| Cell | Means | Draw |
|---|---|---|
| Empty | Outside the range — a day that has not happened | **No square at all** |
| `0` | Measured, and nothing happened | The quietest step |

Collapsing them makes a calendar say "nobody worked" about a month nobody has reached yet, and
loses the staircase that shows which cohort rows are still filling. It is invisible in the
output, which is why it survives for years. Keep `null` and `0` apart from the parser all the
way to the square.

## The markup

An ordinary `<table>`: row headings become row labels, column headings become column labels,
each cell a square. The first heading sits above the row labels and names nothing on the grid.
This is the chart the table contract fits best, because the two are the same shape.

## No numbers in the squares

A heatmap with a figure in every cell is a table — and printing one means choosing the ink per
step, since one grey cannot sit on both ends of a ramp. Give the value three other ways: a
read-out, an announcement, and the table.

## The grid is a picture; the table is the content

Put `aria-hidden="true"` on the **whole grid**. Exposing the cells as well reads every figure
twice — once as a field of squares, once as the table it came from — and the table is much the
better reading.

That decision has a consequence worth stating: **make the cells `<span>`s, not `<button>`s.** A
focusable element inside an `aria-hidden` subtree is a trap for anyone arriving by keyboard.
Nothing inside the grid is focusable; the frame is the single tab stop and a `role="status"`
region says what was landed on.

## Four arrows, and step over the holes

A grid has two directions. Cells outside the range are skipped rather than landed on — there
is nothing to read there, and a keyboard that stops on holes feels broken. On a cohort triangle
that is most of the top-right corner.

**Ring the cell being read; do not recolour it.** Its colour is its value. Reserve the ring as
a transparent outline rather than adding one on hover, or the cell grows and shifts its
neighbours.

## Linear by default, rank-based on request

Equal slices is the honest default: a colour means the same quantity wherever it appears.

Offer rank-based steps for a grid one cell dominates — one endpoint at four hundred against a
field of single digits flattens everything else into step one. The cost is that colour stops
meaning a fixed amount, so **say so under the grid** whenever it is on. A reader who assumes a
linear scale reads a quantile grid backwards.

Offer `max` to pin the ceiling, or two grids side by side use the same colours for different
numbers.

## Verify before calling it done

Keep the binning, the thresholds and the parsing reachable without a browser.

- Every variant runs in an iframe with no external request and no overflow.
- **Render it and look at it.**
- With scripting off, every variant is a complete table.
- An empty cell draws no square; a written zero draws the quietest one.
- The legend is present whenever there is a scale, and absent when nothing is above zero.
- No number is printed inside a square.
- The grid is `aria-hidden` and contains nothing focusable.
- Four arrows walk it, holes are stepped over, and the reading is announced.
- `quantile` produces different edges from `linear` on skewed data, and says so.
- A wide grid scrolls inside its own box rather than pushing the page.
- Generate the thumbnail's squares with the component's own binning rather than by eye.
