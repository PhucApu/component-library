# Recreate Heatmap Chart as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-heatmap-chart>` using
plain HTML, CSS, and JavaScript. No React, no TypeScript, no Tailwind runtime, no charting
library, no backend, no new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## Colour carries size, which inverts the usual rules

One hue stepped light to dark, **five steps**, and a legend that is **never optional** — a
colour meaning "a lot" says nothing until the reader is told how much. Validate the ramp
against your own two surfaces for three things a categorical check does not cover: monotonic
lightness, separable neighbours, and a lowest step separable from a zero cell.

**Run the ramp the other way in dark mode**, or the busiest cells sink into the background.

## Empty is not zero

An empty cell is **outside the range** and gets no square. A written `0` was measured and gets
the quietest square. Collapsing them makes a calendar say "nobody worked" about a month nobody
has reached yet — invisible in the output, which is why it survives.

## Output

```text
heatmap-chart.html
heatmap-chart.css
heatmap-chart.js
README.md
```

The data is an ordinary `<table>`: row headings become row labels, column headings become
column labels, each cell a square. Use `lang="en"`, and say the page must be served over HTTP
while noting the table is readable either way.

## The rules that matter

**No numbers in the squares.** A heatmap with a figure in every cell is a table, and printing
one means choosing the ink per step. Give the value through a read-out, an announcement, and
the table.

**The grid is `aria-hidden` in its entirety**; the table is the accessible content. Exposing
both reads every figure twice. Consequently the cells are `<span>`s, not `<button>`s — a
focusable element inside an `aria-hidden` subtree traps a keyboard user. The frame is the one
tab stop.

**Four arrow keys**, because a grid has two directions, and **step over the holes** — a
keyboard that stops on empty cells feels broken.

**Ring the cell being read, do not recolour it.** Its colour is its value. Reserve the ring as
a transparent outline so the cell never grows and shifts its neighbours.

**Linear by default; offer rank-based steps** for a grid one cell dominates, and **say so under
the grid** when they are on — colour has stopped meaning a fixed amount. Offer a pinned ceiling
so two grids agree.

## Verify before delivering

- Open the network panel: nothing leaves the origin.
- **Look at it.**
- Turn scripting off: the table is all there.
- Leave a cell empty and write `0` in another: one square, not two, and not none.
- Feed it a grid where one cell is a hundred times the rest, then switch scales.
- Tab once, then walk the grid with all four arrows, over the holes.
- Narrow the window: the grid scrolls inside its own box, not the page.
