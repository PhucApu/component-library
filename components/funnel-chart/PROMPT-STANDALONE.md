# Recreate Funnel Chart as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-funnel-chart>` using plain
HTML, CSS, and JavaScript. No React, no TypeScript, no Tailwind runtime, no charting library,
no backend, no new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## Not a trapezoid

The tapering funnel encodes its value as a width and hands the eye an **area** to read, and a
trapezoid's area is not proportional to its value — so every drop looks worse than it was.
Draw **ordered horizontal bars from one shared left edge**. Length from a common origin is the
channel people compare accurately. No polygon in the DOM.

## One colour, and the loss gets the ink

Position already carries the order; length already carries the value. Shading each stage a
different depth spends the only free channel restating the order.

Give every bar one colour, then draw **the loss**: a shaded run starting exactly where each bar
ends and finishing exactly where the previous bar did. **Mark the largest drop**, with a word as
well as a fill, and find it by **count rather than rate** — the worst rate is usually the last
step of a long funnel, where losing three people reads as a catastrophe.

Offer an ordinal ramp as an opt-in, capped at six steps. Validate it against your own surfaces:
unlike a sequential ramp, no step may recede toward the surface, so every step clears `2:1` and
neighbours clear `1.2`. Space it evenly, and **compare on exact ratios** — rounding first turns
`1.1950` into `1.20 PASS`.

## Two rates, and the count

Print both "of previous" (finds the broken step) and "of the top" (the number reported), except
on the second stage, where they are the same figure. Print the **absolute loss** always: a rate
has to be turned back into people before anyone can argue about it.

A first stage converts nothing — no step rate, and no "100% of the top". A top of zero gets no
rates at all rather than `0%` or `NaN%`.

## A stage that grew is a sentence

More people at step four than at step three cannot be drawn. Name the stage, say what usually
causes it, keep the bars inside their track, and paint no impossible drop region.

## Output

```text
funnel-chart.html
funnel-chart.css
funnel-chart.js
README.md
```

The data is an ordinary `<table>`: one label column, one value column, and **row order is stage
order** — never sorted. Use `lang="en"`, and say the page must be served over HTTP while noting
the table is readable either way.

## The rules that matter

**The rates are computed**, so they live nowhere accessible unless you put them there. Put
`aria-hidden` on the whole bar list — every word in it is already in the table or the summary,
and exposing both reads the funnel twice. Consequently nothing inside it is focusable; the frame
is the one tab stop.

**Make the summary line visible**, not screen-reader-only. The overall rate and the worst step
are the findings the chart exists to produce.

**Assemble the announcement from the parts that exist.** A template carrying its own commas
announces `Received, 4,820, ,` on a first stage.

**Up and down only.** A funnel has one direction; left and right invite a reader to look for
something sideways that is not there. Neither end wraps.

**Offer `max`** to pin the ceiling, or two funnels side by side each scale to their own top and
the smaller one's second bar can draw longer than the larger one's.

## Verify before delivering

- Open the network panel: nothing leaves the origin.
- **Look at it.**
- Turn scripting off: the table is all there.
- Measure the bars: all start at zero, every drop lands on the previous bar's end.
- Pin `max` and confirm the drawing changes while every rate stays put.
- Feed it a stage bigger than the one before: named, not drawn.
- Feed it one stage, and a top of zero: no invented rate, no `NaN`.
- Tab once, walk with the arrows, confirm neither end wraps.
- Re-measure every contrast floor in both themes, on exact ratios.
- Narrow the window: nothing pushes the page sideways.
