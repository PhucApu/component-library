# Donut Chart - Design Specification

## 1. Purpose

Composition: how one total divides. Traffic sources, order status, plan mix — the chart every
admin dashboard has and the one most often used for the wrong question.

## 2. Built around a known weakness rather than around a denial of it

The data-visualisation literature is blunt about rings, and so is the skill this collection
follows: a donut is the wrong form for comparing close values, because angle is read poorly
and length is read well.

That is true, and this component still exists, because the form is genuinely useful for a
lopsided split with a meaningful total — and because it will be built anyway. So the design
question was not *whether* but *how to make the weakness survivable*:

| Guardrail | What it prevents |
|---|---|
| **Six wedges at most**, tail folded | Slivers with labels that have nowhere to sit |
| **Legend always carries the number and the share** | Anyone having to estimate an angle |
| **The table cannot be removed** | The values being reachable only through the shape |
| **A whole variant showing the same data as bars** | The rule being an opinion in a README |

The Versus variant is the honest part. It puts five close values side by side as a ring and as
bars, and invites the reader to order them from the ring first. That difficulty is the
argument; no prose replaces it.

## 3. Folding is the default here, and not in the line chart

`cartesian-chart` refuses to fold a ninth series without being asked, because summing changes
what the author wrote and a ninth line is still a readable line.

A ninth wedge is not a readable wedge. Past six the form stops answering its own question, so
here folding is what happens and the note says how many were folded. The same reasoning
produced opposite defaults, which is the point: the rule is about legibility, not about a
house preference for folding.

The remainder takes the **last slot** rather than a new colour, and is always last in reading
order. An `Other` in the middle of a legend reads as a category somebody named.

## 4. What cannot be part of a whole

Negative values are dropped and counted. A negative share of a total is not a thing: drawn, it
would either invert a wedge or silently shrink everybody else. The note says how many were
left out, so the chart never pretends the data was what it wanted.

A total of zero says so in words. An empty circle with a legend beside it looks like a chart
that failed to load rather than a true answer.

**One value column.** A ring divides one total. A table with three value columns is three
rings or a bar chart; the note names the columns that are not plotted rather than letting the
first stand in for all of them.

## 5. The hole is the reason it is a ring

A pie has nowhere to put the number the parts are parts of. The hole holds the total, and
while a wedge is being read it holds that wedge instead.

That decision replaces a floating tooltip entirely. The middle of a ring is where the reader
is already looking and it was empty; a panel beside the pointer would cover the wedges while
saying less.

## 5a. Emphasis is a pair, and the ring is sized for it

The wedge being read **comes out of the ring** along its own middle angle and keeps its full
strength; the others drop to a third.

Both halves are needed. Lifting alone is easy to miss on a small ring — seven pixels out of a
hundred-pixel radius is not much. Dimming alone leaves nothing for the eye to land on and reads
as the chart going quiet rather than as one part being chosen. Together they are unmistakable.

Two consequences that are easy to get wrong:

- **The ring is sized with the lift already subtracted.** Drawn to fill its box, a wedge would
  be cropped by the canvas edge at exactly the moment somebody was looking at it. The outer
  radius is `size / 2 - lift - 3`.
- **Nothing is emphasised at rest.** A ring that dims itself before anyone touches it looks
  broken. The `data-reading` flag lives on the frame rather than on each wedge, so the dimming
  is one rule about "something is being read" rather than a class written onto every wedge
  that is not it.

The first version had this backwards — the wedge being read was the one that faded. Pointing
at something and watching it recede is the opposite of what a pointer means.

Pointing at a legend row does the same thing. The row and the wedge are one fact said twice.

## 6. Geometry

Angles run from twelve o'clock clockwise, because that is where a reader starts.

The gap between wedges is **two pixels of the surface**, taken out of each wedge rather than
drawn on top, so the wedges still add up to the whole circle. It is specified in pixels and
converted to an angle at the middle radius, so a small ring and a large one look the same —
and it is clamped per wedge at half the wedge's own span, or a sliver would be spaced out of
existence.

A single slice gets **no** gap and is drawn as a full ring. A circle with a two-pixel notch
reads as a rendering fault.

A full turn cannot be drawn as one SVG arc: its start and end points are identical and the
renderer cannot tell a complete circle from nothing at all. It is drawn as two half circles.

## 7. The legend does the work the shape cannot

Name, number and share, always. This is the component's answer to its own weakness and it is
not optional furniture.

Pressing a row hides that wedge, and **the survivors keep their colours** — bound to the row's
position, never to its rank among what is currently shown. The shares recalculate against what
remains, which is what a part-to-whole chart is for, and the total in the hole follows.

The last visible wedge will not switch off: an empty ring under a full legend reads as broken
rather than as a choice.

## 8. One tab stop, not six

The wedges carry `tabindex="-1"` and the frame carries the tab stop; the arrows move within
it. Six wedges that each take a tab press is six presses somebody has to make to get past one
chart, and people learn to skip charts that behave that way.

Keyboard reading produces exactly what the pointer produces, announced through a
`role="status"` region that is present and empty beforehand.

## 9. Colour

The first six of the validated eight slots, in the order that keeps neighbouring pairs apart
under colour-vision simulation. **The last two are deliberately not defined** in this
component's CSS: a token that exists is a token somebody will reach for, and a ring may not
use them.

## 10. Variants

| Variant | Teaches |
|---|---|
| Default | The ring, the hole, the legend that carries the numbers |
| Versus | The same five close values as a ring and as bars — the argument, not the assertion |
| Folding | Eleven rows into six wedges, a remainder that is not a category, columns not plotted |
| Interaction | Pointer and keyboard reading the same thing; a legend that does not repaint |
| Table | The data contract, and why a ring needs its table more than a bar chart does |
| States | One slice, a total of zero, refetching, a failure, values that cannot be part of a whole |

## 11. Tokens

| Token | Role |
|---|---|
| `--donut-series-1` … `-6` | The first six validated slots |
| `--donut-surface`, `--donut-ink`, `--donut-ink-soft`, `--donut-ink-muted`, `--donut-border` | Surface and ink |
| `--donut-focus`, `--donut-radius`, `--donut-height` | The frame |
| `--donut-gap`, `--donut-motion` | The spacer and the hover fade |
| `--mark-colour` | Written by the element onto a wedge, swatch or table key |

## 12. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. Its wedge
paths were **generated by this component's own arc geometry** rather than drawn by eye, so the
miniature is the same arithmetic as the real thing. No animation, script, external asset, or
embedded raster image.

## 13. Acceptance criteria

- All six variants run independently in an iframe with **no external request** and no overflow.
- With scripting disabled every variant is a complete, readable table.
- Never more than six wedges are drawn, whatever the table holds.
- The folded remainder is last, takes the last slot, and the note says how many it holds.
- Negative rows are excluded and counted; a total of zero says so rather than drawing a ring.
- A table with extra value columns says which are not plotted.
- Hiding a wedge leaves every survivor's colour unchanged, and the shares and total follow.
- The last visible wedge cannot be switched off.
- One slice is a full ring with no gap.
- The legend carries a number and a share for every wedge.
- Keyboard reading equals pointer reading, and the ring is one tab stop.
- The hole shows the total, and the wedge being read while one is being read.
- The wedge being read comes out of the ring at full strength while the others dim, from the
  pointer, from a legend row, and from the keyboard alike.
- A lifted wedge is never clipped by the frame, at any position on the ring.
- Nothing is emphasised until something is being read.
- Contrast reaches AA in both themes.
