# Funnel Chart - Design Specification

## 1. Purpose

An ordered sequence people fall out of: checkout, signup, onboarding, a hiring pipeline, a
support queue. The question is never "how many at each step" — a table answers that — but
**where are they going, and how many.**

## 2. The trapezoid is the anti-pattern

The tapering shape everyone recognises encodes the value as a **width** and then hands the eye
an **area** to read. The area of a trapezoid is not proportional to the number it stands for,
so every drop comes out looking worse than it was, always in the same direction.

Bars from a shared left edge put the value in a **length**, which is the one visual channel
people compare accurately. The shape is lost; the honesty is gained. Nothing in the rendered
DOM is a polygon, and a test asserts it.

## 3. One colour, and where the free channel goes instead

This is a change of mind from the original roadmap, and the reasoning is worth keeping.

The stages are ordered, so an ordinal ramp is *allowed* — but it is not *useful*. The vertical
position already carries the order and the bar length already carries the value. Shading each
stage a different depth spends the only free channel restating something the layout already
shows, which is the same fault as colouring a bar chart by its own bar height.

So the bars are one colour, and colour goes to the thing nothing else shows: **the loss**. Each
drop is drawn as a shaded run beginning exactly where its bar ends and finishing exactly where
the previous bar did, and the biggest one is marked.

| Colour | Carries | Floor | Light | Dark |
|---|---|---|---|---|
| Bar vs surface | A UI mark | `3.0` | `4.4154` | `4.7890` |
| Drop region vs surface | An area, not blank paper | `1.2` | `1.2507` | `1.2462` |
| Drop region vs bar | Two different things | `2.0` | `3.5303` | `3.8428` |
| Largest drop vs an ordinary one | The marking | `1.15` | `1.2059` | `1.2329` |
| Its label on its own fill | A word | `4.5` | `5.1522` | `5.8607` |

**Measured on exact ratios.** An earlier dark drop region was recorded as `1.20 PASS` by a
check that rounded to two places before comparing; the browser measured the same pair at
`1.1950` and the floor was never actually met. The check now compares first and rounds only to
print.

## 4. The ordinal ramp, for anyone who wants the familiar look

`shade="stages"` turns it on. Ordinal is a **third** kind of colour problem, after the
categorical palettes of `cartesian-chart` and `donut-chart` and the sequential ramp of
`heatmap-chart`:

| | Categorical | Sequential | Ordinal |
|---|---|---|---|
| Carries | Identity | Magnitude | Discrete order |
| The safety rule | Neighbours stay apart under CVD | Lightness stays monotonic | **Every step must be seen** |
| The palest step | Must be distinguishable | **May recede** toward the surface | **May not** — a stage is a bar, not a shade of nothing |

```text
                        light #ffffff   dark #171a20
worst step vs surface   2.1103          2.1503        (floor 2.0)
worst neighbouring pair 1.4152          1.3508        (floor 1.2)
```

The first candidate ran `650, 700` as its last pair where every other gap was twice that, and
that one uneven step measured `1.21` and `1.18`. Spacing the ramp evenly — one rung of the
scale per step — moved the weakest pair to `1.4152` and `1.3508`.

**Six steps, and that caps the ramp rather than the data.** A seven-step funnel is an ordinary
thing to measure, and nothing is folded or discarded: summing two stages of a funnel would be
meaningless, unlike summing two slices of a donut. Past six, `shade="stages"` falls back to one
colour and says so underneath.

## 5. Two rates, because there are two questions

Printing only one is the commonest fault in the form.

| | Means | Finds |
|---|---|---|
| **Of previous** | Of those who reached this stage, how many went on | The broken step — it is not dragged down by the losses above it |
| **Of the top** | Of everyone who entered, how many got this far | The number the business earns |

The `rates` variant makes the difference visible: with only the from-the-top rate on, the
invite step reads as a slide from `93.1%` to `32.5%` and the last step looks like the disaster.
The step rates say it plainly — the invite step keeps `34.9%`, the paid step `22.3%`. Two
different problems, one of them invisible until the denominator changed.

**The second stage prints only one rate**, because there its previous stage *is* the top and
the two are the same figure. Printing both reads as a mistake.

**The absolute loss is always printed.** A rate is something a reader has to turn back into
people before it can be argued about in a meeting; `12,200 lost` already is the sentence.

## 6. The largest drop is found by count

By count, not by rate. The worst *rate* is usually the last step of a long funnel, where a
handful of people are left and losing three of them reads as a catastrophe. The worst *count*
is where the work is. A tie settles on the earlier stage — deterministically, and because
earlier in a funnel is where a fix pays more.

The marking is a **word as well as a fill**, so it survives a greyscale print and a colour-blind
reader.

## 7. A stage that grew is not a funnel

More people at step four than at step three describes a shape that cannot exist. Rather than
drawing it — which would mean a bar longer than the one it came from and a conversion rate
above 100% — the stage is **named**, with the two usual causes: stages measured over different
windows, or people joining part-way through.

The bars still draw, clamped inside their own track, and the impossible drop region is simply
not painted.

## 8. What is computed, and where it goes

The table holds stage names and counts. The rates are **computed**, so they exist nowhere in
the accessible content unless they are put there. That shaped the accessibility decision:

- The bar list carries `aria-hidden="true"` in its entirety. Every word in it is either already
  in the table or already in the summary, so exposing both would read the funnel twice.
- The **summary line is visible**, not screen-reader-only. It carries the two findings — the
  overall rate and the worst step — and a sighted reader should not have to derive them from
  the bars any more than anyone else should.
- Walking the stages announces name, figure, both rates, the loss, and the marking through a
  `role="status"` region.

The announcement is **assembled from the parts that exist** rather than poured into a template
carrying its own punctuation. A template that writes the commas announces `Received, 4,820, ,`
on a first stage, where there is no rate to put between them.

## 9. Up and down only

A funnel has one direction. `heatmap-chart` needed four arrows for a grid; offering left and
right here would invite a reader to look for something sideways that is not there. `Home` and
`End` reach the ends, `Escape` lets go, and neither arrow wraps — a list that jumps from bottom
to top loses the reader's place.

The frame is the single tab stop, and nothing inside the `aria-hidden` list is focusable.

## 10. `max` pins the ceiling

Left to itself each funnel scales to its own tallest stage, so a funnel of 6,900 draws the same
full-width top bar as one of 18,400. Side by side, every pair of bars below then invites a
comparison that is not there — in the `compare` variant the mobile funnel's second bar draws
*longer* than desktop's while counting 2,480 against 6,200.

Pinned, the two share one ruler. The rates never move, which is the useful half of the lesson:
a shape can mislead while every number beside it stays true.

## 11. Variants

| Variant | Teaches |
|---|---|
| Default | Ordered bars, both rates, the loss drawn where it happened, the largest drop marked |
| Shape | Why not a trapezoid, and the optional six-step ordinal shading |
| Rates | Step-to-step against from-the-top, and the broken step only one of them finds |
| Compare | Two funnels, and the pinned ceiling that makes them comparable |
| Table | The data contract, the no-script fallback, and why row order is never sorted |
| States | A stage that grew, a single stage, a top of zero, refetching, a failure |

## 12. Tokens

| Token | Role |
|---|---|
| `--funnel-bar` | The one colour every stage takes by default |
| `--funnel-drop` | The shaded run showing what was lost |
| `--funnel-drop-worst`, `--funnel-worst-ink` | The largest drop and its label |
| `--funnel-stage-1` … `-6` | The opt-in ordinal ramp |
| `--funnel-surface`, `--funnel-ink`, `--funnel-ink-soft`, `--funnel-ink-muted`, `--funnel-border` | Surface and ink |
| `--funnel-bar-size`, `--funnel-bar-radius`, `--funnel-radius` | Geometry |
| `--funnel-focus`, `--funnel-motion` | |
| `--bar-colour` | Written by the element onto a bar |

`--funnel-bar` is deliberately **not** `--funnel-stage-1`. The default bar is the accent at full
strength; the ramp's first step is its palest rung. One token cannot be both without one of the
two measurements being wrong.

## 13. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. Every bar and
every drop region was **placed by this component's own arithmetic** rather than by eye,
including which stage carries the largest-drop marking. No animation, script, external asset,
or embedded raster image.

## 14. Acceptance criteria

- All six variants run independently in an iframe with **no external request** and no overflow,
  at 960 and 360.
- With scripting disabled every variant is a complete, readable table.
- No polygon is drawn; every bar starts at zero on one shared baseline.
- Each drop region begins where its bar ends and finishes where the previous bar did.
- One colour for every stage by default; `shade="stages"` gives six distinct steps and falls
  back to one colour past six, saying so.
- The largest drop is marked exactly once, chosen by count, in words as well as colour.
- Both rates are printed and each is named; the second stage prints only one.
- A first stage, a single stage, and a top of zero report no invented rate and no `NaN`.
- A stage larger than the one before it is named rather than drawn.
- `max` pins the ceiling so two funnels share one ruler.
- The bar list is `aria-hidden` and contains nothing focusable; the frame is one tab stop.
- Up and down walk the stages, neither end wraps, and the reading is announced.
- Every measured contrast floor in sections 3 and 4 is met in both themes, on exact ratios.
