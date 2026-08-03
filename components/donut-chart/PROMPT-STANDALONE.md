# Recreate Donut Chart as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-donut-chart>` using plain
HTML, CSS, and JavaScript. No React, no TypeScript, no Tailwind runtime, no charting library,
no backend, no new dependency. Every mark is SVG you write.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## Build it around its weakness

A ring answers "how does this total divide" well and "which of these two is bigger" badly.
Angle is read poorly; length is read well. Make the weakness survivable rather than hidden:

- **Six wedges at most**, the tail folded into one.
- **The legend always carries the number and the share.**
- **The table cannot be removed** — on a ring it is the only accurate way to read a value.
- Say plainly in the README **when to use a bar chart instead**: when the point is the
  ordering, when the values are close, or when there are more than about four of them.

## The markup

An ordinary `<table>`: first column the names, second column the values. A ring divides **one**
total, so if there are more value columns, plot the first and **say so**. `data-value` carries
the number, the text carries the wording, and nothing reformats what the author wrote.

Negative values are dropped and counted — a negative share of a total is not a thing. A total
of zero says so in words rather than drawing an empty circle that looks like a failure.

## Output

```text
donut-chart.html
donut-chart.css
donut-chart.js
README.md
```

`donut-chart.js` is one ES module holding the geometry and the element, defining it only when
it is not already registered. Use `lang="en"`, and say the page must be served over HTTP while
noting the table is readable either way.

## The hole

A pie has nowhere to put the number the parts are parts of. Put the total there, and the wedge
being read there while one is being read. This replaces a floating tooltip: the middle of a
ring is where the reader is already looking, and a panel beside the pointer covers wedges
while saying less.

## Geometry, with the traps

Angles from twelve o'clock clockwise.

- The gap is **the surface**, taken out of each wedge, so they still add up to the circle.
- Specify it in **pixels** and convert to an angle at the middle radius, or small and large
  rings look different.
- **Clamp it per wedge** at half that wedge's span, or a sliver disappears into its own
  spacing.
- **One slice is a full ring with no gap** — a notch in a circle reads as a fault.
- **A full turn cannot be one SVG arc**: start and end are the same point. Draw two halves.

## The legend and the keyboard

Name, number and share for every wedge. Pressing a row hides it, **survivors keep their
colours**, and the shares recalculate against what is left.

Wedges take `tabindex="-1"`; the frame takes the single tab stop and the arrows move within
it. Keyboard reading equals pointer reading, announced through a `role="status"` region.

## Verify before delivering

- Open the network panel: nothing leaves the origin.
- **Look at it.**
- Turn scripting off: the table is all there.
- Feed it eleven rows: six wedges, remainder last, note says how many.
- Feed it a negative and a zero total: both are stated, neither is drawn.
- Hide a wedge from the legend: no survivor changes colour; the total follows.
- Feed it one row: a full ring with no notch.
- Tab to the ring once, then walk it with the arrows.
