# Recreate Funnel Chart

You are a Senior Frontend Engineer. Build a Web Component named `<ui-funnel-chart>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
charting library, a backend, or a new dependency.

## Do not draw the shape everyone expects

The tapering funnel encodes its value as a **width** and then hands the eye an **area** to read,
and the area of a trapezoid is not proportional to the number it stands for. Every drop comes
out looking worse than it was, always in the same direction.

Draw **ordered horizontal bars from one shared left edge**. Length from a common origin is the
one visual channel people compare accurately. You lose the recognisable silhouette; that is the
trade, and it is the right way round.

Nothing in the rendered DOM should be a polygon.

## One colour, and spend the free channel on the loss

The stages are ordered, so an ordinal ramp is *allowed*. It is not *useful*: vertical position
already carries the order and bar length already carries the value, so shading each stage a
different depth spends the only free channel restating what the layout already shows.

Give every bar one colour. Then draw **the loss** — a shaded run beginning exactly where each
bar ends and finishing exactly where the previous bar did, so the piece that fell off appears
at the size it actually was. In most funnels that quantity gets no ink at all and the reader is
left subtracting two numbers to find the subject of the chart.

**Mark the largest drop**, and mark it with a word as well as a fill.

Offer the ordinal ramp as an opt-in for anyone who wants the familiar look. Validate it as a
**third** kind of colour problem: unlike a sequential ramp, no step may recede toward the
surface — a funnel stage is a bar that has to be seen, not a shade of nothing — so every step,
including the palest, clears `2:1` against its own surface, and neighbours clear `1.2`.

Space that ramp **evenly**. A run that crowds two steps together at one end will measure fine
overall and fail on exactly that pair.

**Compare contrast on exact ratios.** Rounding to two places before the comparison turns
`1.1950` into `1.20 PASS`, and the browser does not round.

## Cap the ramp, not the data

Six steps is where the ramp runs out. A seven-step funnel is an ordinary thing to measure, so
draw them all — summing two stages of a funnel would be meaningless, unlike summing two slices
of a donut. Past six, fall back to one colour and **say so**.

## Two rates, and the count

Printing one is the commonest fault in the form.

| | Means | Finds |
|---|---|---|
| Of previous | Of those who reached this stage, how many went on | The broken step, undragged by the losses above it |
| Of the top | Of everyone who entered, how many got this far | The number the business earns |

On the **second** stage the previous stage *is* the top, so the two are the same figure. Print
one; printing both reads as a mistake.

Print the **absolute loss** as well, always. A rate is something a reader has to turn back into
people before it can be argued about; `12,200 lost` already is the sentence.

Find the largest drop by **count, not rate**. The worst rate is usually the last step of a long
funnel, where a handful of people are left and losing three of them reads as a catastrophe.

## A first stage converts nothing

No step rate, and no "100% of the top" either — printing that invents a stage that does not
exist. A single stage gets no summary. A top of zero makes every rate a division by zero, and
absent is the truthful answer rather than `0%` or `NaN%`.

## A stage that grew is a sentence, not a picture

More people at step four than at step three describes a shape that cannot exist. Name the stage
and say what usually causes it — stages measured over different windows, or people joining
part-way through. Keep the bars inside their own track and paint no impossible drop region.

## The markup

An ordinary `<table>`: one label column, one value column. Row order **is** stage order — do not
sort, because a funnel sorted by size is a bar chart that threw away the sequence.

Let `data-value` settle anything ambiguous, and leave a second value column alone rather than
plotting it as a stage.

## The rates are computed, so decide where they live

The table holds names and counts. The rates exist nowhere in the accessible content unless you
put them there, and that shapes the whole accessibility design:

- Put `aria-hidden` on the **whole bar list**. Every word in it is already in the table or in
  the summary, and exposing both reads the funnel twice.
- Make the cells `<span>`s, not buttons. Nothing inside an `aria-hidden` subtree may be
  focusable; the frame is the single tab stop.
- Make the **summary line visible**, not screen-reader-only. The overall rate and the worst step
  are the two findings the chart exists to produce, and a sighted reader should not have to
  derive them from the bars either.
- Announce the full reading through a `role="status"` region when the stages are walked.

**Assemble that announcement from the parts that exist.** A template carrying its own
punctuation announces `Received, 4,820, ,` on a first stage.

## Up and down only

A funnel has one direction. Offering left and right invites a reader to look for something
sideways that is not there. `Home` and `End` reach the ends, `Escape` lets go, and neither end
wraps.

## Pin the ceiling

Offer `max`. Without it each funnel scales to its own tallest stage, so 6,900 draws the same
full-width top bar as 18,400 — and side by side the smaller funnel's second bar can draw
*longer* than the larger one's while counting a third as many people.

## Verify before calling it done

Keep the rate arithmetic, the largest-drop rule and the parsing reachable without a browser.

- Every variant runs in an iframe with no external request and no overflow, wide and narrow.
- **Render it and look at it.**
- With scripting off, every variant is a complete table.
- Measure the bars: every one starts at zero, and every drop region lands exactly on the
  previous bar's end.
- One colour by default; the ramp gives distinct steps and falls back past its limit.
- The largest drop is marked once, by count, in words as well as colour.
- A first stage, a single stage, and a top of zero print no invented rate and no `NaN`.
- A risen stage is named, and no bar overflows its track.
- Pinning `max` changes the drawing and leaves every rate untouched.
- Tab once, walk with the arrows, confirm neither end wraps and the announcement is clean.
- Re-measure every contrast floor in both themes, on exact ratios.
- Generate the thumbnail's bars with the component's own arithmetic rather than by eye.
