# Recreate Cartesian Chart as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-cartesian-chart>` using
plain HTML, CSS, and JavaScript. No React, no TypeScript, no Tailwind runtime, no charting
library, no backend, no new dependency. Every mark is SVG you write.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

**The data is an ordinary `<table>` in the light DOM, and it stays one.** First column the
categories, every column after it a series named by its heading. Read it, keep it, and add
nothing to it but a colour key beside each heading.

That table is the fallback with no script, the accessible twin a chart is supposed to have,
and — because some light-theme series colours will sit below `3:1` on white — the thing that
makes those colours legal at all. **Ship no attribute that removes it.** Collapsed it is
visually hidden and still in the page, so a screen reader keeps every number while the
drawing stays `aria-hidden`.

Support `line`, `area`, `column` and horizontal `bar`, grouped and stacked, in one component:
all four share the scales, axes, grid, legend and read-out.

Cells are written for people. Parse `$4,200`, `1 234`, `12%` and the accounting negative
`(890)`; let `data-value` win, which is the way out for a decimal comma. Keep the original
text so the read-out shows the number as it was written. **An empty cell is missing, not
zero** — a line breaks across it and a stacked segment adds nothing to its total.

## Output

```text
cartesian-chart.html
cartesian-chart.css
cartesian-chart.js
README.md
```

- `cartesian-chart.js` is one ES module holding the DOM-free rules and the custom element. It
  defines the element only when it is not already registered.
- `cartesian-chart.css` holds every style, including the eight validated colour slots.
- `cartesian-chart.html` is a runnable example.
- `README.md` documents the table contract, the attributes, the keyboard, **and the three
  things this component refuses to do**.

Use `lang="en"`. ES modules do not load from `file://`, so say the page must be served — while
noting the table is still readable either way.

## Three refusals, each with an alternative

- **No second value axis, and no API for one.** Two scales on one plot invent a correlation
  the data does not have. The alternative is two charts, or both series indexed to a common
  base.
- **No bar that starts anywhere but zero.** `y-min` pulls the floor down, never up. A line is
  read by its shape and is free.
- **No ninth colour.** Eight slots; the tail is not drawn and the table holds it, unless the
  author asks for `fold-others` to sum it.

## Colour

Run a validated categorical palette against **your own two surfaces** before shipping it —
contrast against a surface the chart never renders on means nothing. The **order of the slots
is the colour-vision safety mechanism**, so record the measured numbers next to the palette.

Bind a series to the column it was written in, so hiding one never repaints the others. One
series means **one colour for every bar** — shading them by height double-encodes the length.
Write the eight `var()` references out rather than building the property name from a number.

## Marks

- Bars `≤ 24px`, lines `2px`, markers `8px`, area fills `10%`, grid and axis a solid `1px`
  hairline — never dashed.
- **Two pixels of the surface** separate touching marks, taken out of the mark rather than
  drawn on top. Markers get a `2px` surface ring. Never a stroke around a mark.
- **Build the bar from a path.** `<rect rx>` rounds all four corners, lifting the bar off its
  own zero and turning a stack into separate pills. Two rounded corners at the data end; in a
  stack only the outermost segment.

## Labels and reading

Legend for two or more series, none for one. Direct labels selectively — the end of a line,
the cap of a bar with a single series. **Reserve the label's room before sizing the plot, and
measure against the frame rather than the plot**; drop a label that will not fit rather than
clipping it. Text never wears the data colour.

A crosshair snaps to the nearest category and **one read-out lists every series there**. The
keyboard walks the same positions and produces the same content through a `role="status"`
region. Nothing is gated behind hover.

## Layout

Measure every inset — the widest tick, the category labels, the end labels. Redraw at the
element's real size rather than scaling a `viewBox`, which stretches text. Thin category
labels rather than rotating them, and keep the last one. Include the axis band in the frame's
height.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Open the network panel: nothing leaves the origin.
- **Look at it.** A colour validator checks colour, not layout.
- Turn scripting off: every number is still there.
- No second axis anywhere in the output.
- Columns start at zero; a single-series bar chart is one colour.
- Hide a series from the legend: no survivor changes colour.
- No text crosses the frame edge — and exclude any measuring node from that check.
- Tab to the chart and walk it: the same values hover gives, announced.
- Empty a cell: the line breaks rather than diving to zero.
