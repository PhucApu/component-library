# Recreate Donut Chart

You are a Senior Frontend Engineer. Build a Web Component named `<ui-donut-chart>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
charting library, a backend, or a new dependency. Every mark is SVG you write.

## Build it around its weakness, not around a denial of it

A ring answers "how does this total divide" well and "which of these two is bigger" badly:
angle is read poorly, length is read well. That is true, the form is still genuinely useful
for a lopsided split with a meaningful total, and it will be built anyway.

So the design question is not *whether* but *how to make the weakness survivable*:

- **Six wedges at most**, tail folded into one.
- **The legend always carries the number and the share.** Nobody estimates an angle.
- **The table cannot be removed.**
- **Ship a variant that shows the same data as bars.** Put five close values side by side as a
  ring and as bars and invite the reader to order them from the ring first. That difficulty is
  the argument; prose is not.

## The markup, and one value column

```html
<ui-donut-chart>
  <table>
    <caption>Traffic by source</caption>
    <thead><tr><th>Source</th><th>Sessions</th></tr></thead>
    <tbody><tr><th>Organic search</th><td data-value="18400">18,400</td></tr></tbody>
  </table>
</ui-donut-chart>
```

A ring divides **one** total. If the table has more value columns, plot the first and **say
so** — quietly drawing it would let somebody believe the others were in there.

`data-value` carries the number, the text carries the wording, and nothing reformats what the
author wrote.

## Folding is the default here — and note why that differs

A line chart should refuse to fold without being asked: summing changes what the author wrote,
and a ninth line is still a readable line. A ninth **wedge** is not. Same reasoning, opposite
default; the rule is about legibility rather than a house preference.

Give the remainder the **last slot** rather than a new colour, and put it last in the legend.
An `Other` in the middle reads as a category somebody named rather than as what is left.

## What cannot be part of a whole

- **Negative values** are dropped and counted in a note. Drawn, one would either invert a
  wedge or silently shrink everybody else.
- **A total of zero** says so in words. An empty circle beside a legend looks like a chart
  that failed to load.

## The hole is the reason it is a ring

A pie has nowhere to put the number the parts are parts of. Put the total there, and while a
wedge is being read put that wedge there instead — name, value, share.

This replaces a floating tooltip entirely, and it is better: the middle of a ring is where the
reader is already looking, and it was empty. A panel beside the pointer covers wedges while
saying less.

## Geometry, with the traps

Angles run from twelve o'clock clockwise.

- **The gap is the surface**, taken *out of* each wedge rather than drawn on top, so the
  wedges still add up to the circle. Specify it in **pixels** and convert to an angle at the
  middle radius, or a small ring and a large one look different.
- **Clamp the gap per wedge** at half its own span, or a sliver is spaced out of existence.
- **A single slice gets no gap** and is a full ring. A circle with a two-pixel notch reads as
  a rendering fault.
- **A full turn cannot be one SVG arc** — start and end are the same point and the renderer
  cannot tell a complete circle from nothing. Draw it as two half circles.

## Emphasis is a pair, and it decides the ring's size

The wedge being read **comes out of the ring** along its own middle angle and keeps its full
strength; the others drop to about a third.

Do both. Lifting alone is easy to miss — seven pixels out of a hundred-pixel radius is not
much. Dimming alone leaves nothing for the eye to land on and reads as the chart going quiet
rather than as one part being chosen.

- **Size the ring with the lift already subtracted.** Drawn to fill its box, a wedge is
  cropped by the canvas edge at exactly the moment somebody is looking at it.
- **Emphasise nothing at rest.** Put the "something is being read" flag on the frame, not on
  every wedge that is not the one being read.
- **A legend row does the same as its wedge.** They are one fact said twice.
- Do not make the wedge being read the one that fades. Pointing at something and watching it
  recede is the opposite of what a pointer means — and it is easy to write by accident.

## The legend does the work the shape cannot

Name, number and share, always. Pressing a row hides that wedge; **the survivors keep their
colours**, bound to the row's position rather than to its rank among what is shown. The shares
recalculate against what remains — that is what a part-to-whole chart is for — and the total
follows. The last visible wedge will not switch off.

## One tab stop, not six

Wedges take `tabindex="-1"`; the frame takes the tab stop and the arrows move within it. Six
wedges that each cost a tab press is a chart people learn to skip. Keyboard reading must equal
pointer reading, announced through a `role="status"` region present and empty beforehand.

## Colour

The first six of a validated categorical order. **Do not define the seventh and eighth tokens
in this component** — a token that exists is a token somebody will reach for, and a ring may
not use them.

## Verify before calling it done

Keep the arc geometry, the folding, the share arithmetic and the gap clamp reachable without a
browser.

- Every variant runs in an iframe with no external request and no overflow.
- **Render it and look at it.**
- With scripting off, every variant is a complete table.
- Never more than six wedges, whatever the table holds.
- The remainder is last, in the last slot, and the note says how many it holds.
- Negatives excluded and counted; a total of zero says so rather than drawing a ring.
- Extra value columns are named as not plotted.
- Hiding a wedge leaves every survivor's colour unchanged; shares and total follow.
- One slice is a full ring with no gap.
- Every legend row has a number **and** a share.
- Keyboard reading equals pointer reading, and the ring is one tab stop.
- The wedge being read lifts at full strength while the others dim — from the pointer, from a
  legend row, and from the keyboard.
- A lifted wedge is inside the frame at every position on the ring. Check all of them: the one
  that overflows is whichever points at the edge nearest the canvas.
- Generate the thumbnail's wedge paths with the component's own geometry rather than by eye.
