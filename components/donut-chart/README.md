# Donut Chart

A framework-free Web Component that reads an ordinary HTML table and draws it as a ring, with
the total in the hole and every number in the legend.

No React, no TypeScript, no Tailwind runtime, no charting library, no build step, no network.

## Read this before you use it

A ring answers **one** question well — how a total divides — and one question badly: which of
two similar wedges is bigger. People read length accurately and angle poorly, and no amount of
design changes that.

| Reach for | When |
|---|---|
| **This** | The point is that these are parts of one whole, and the split is lopsided — one dominant share and a couple of also-rans. The total in the hole is doing real work |
| **A bar chart** | The point is the ordering, the values are close, or there are more than about four of them |

The Versus variant puts the same five close values side by side as a ring and as bars. Look at
it once and the rule stops being an opinion.

Because of that, this component is built to make the weakness survivable rather than to hide
it: **six wedges at most**, the numbers and shares always in the legend, and a table that
cannot be removed.

## The markup

```html
<ui-donut-chart>
  <table>
    <caption>Traffic by source</caption>
    <thead>
      <tr><th scope="col">Source</th><th scope="col">Sessions</th></tr>
    </thead>
    <tbody>
      <tr><th scope="row">Organic search</th><td data-value="18400">18,400</td></tr>
      <tr><th scope="row">Direct</th><td data-value="9100">9,100</td></tr>
    </tbody>
  </table>
</ui-donut-chart>
```

Same contract as `cartesian-chart`, with **one value column**: a ring divides one total. If
the table has more, only the first is plotted and the note says so — quietly drawing the first
would let somebody believe the others were in there.

`data-value` carries the number, the text carries the wording, and neither the hole nor the
legend ever reformats what you wrote.

## Six wedges, and the rest summed into one

Past six, the small wedges are slivers with labels that have nowhere to sit. So the seventh
row onward is folded into `Other`, and the note says how many.

**This is the opposite default from `cartesian-chart`**, deliberately: a ninth line is still a
readable line, a ninth wedge is not a readable wedge.

The remainder keeps the last colour slot rather than being given one of its own, and it is
always last in the legend — an `Other` in the middle reads as a category somebody named rather
than as what is left.

## What cannot be part of a whole

Negative values are left out and counted in the note. A negative share of a total is not a
thing: drawing one would either invert a wedge or quietly shrink everybody else.

A total of zero says so in words. There is no honest ring to draw for nothing, and an empty
circle with a legend beside it looks like a chart that failed to load.

## The hole

A pie has nowhere to put the number the parts are parts of. The hole holds the total; while a
wedge is being read it holds that wedge — its name, its value, its share — so the answer
appears where the reader is already looking rather than in a panel beside the pointer.

`center-label` renames it. Default is `Total`.

## The legend is not a colour key

It carries the name, the **number** and the **share** for every wedge. A ring is read by angle
and nobody reads angle accurately, so this is where the values live and this is the part
people actually read.

Pressing a row hides that wedge. **The survivors keep their colours** — colour follows the row
it was written in, not its rank among what is currently shown. The shares recalculate against
what is left, because that is what a part-to-whole chart is for, and the total follows. A
hidden row is struck through as well as faded, and the last visible wedge will not switch off.

## Reading a wedge

Point at one, or tab to the ring and use `←` `→`, `Home`, `End`, `Escape`.

The wedge being read **comes out of the ring** along its own middle angle and keeps its full
strength while the others step back to a third. The pair is the point: lifting alone is easy
to miss on a small ring, and dimming alone leaves nothing to look at. The ring is sized with
that lift already subtracted, so a wedge is never cropped at the moment somebody is looking at
it.

Pointing at a **legend row** does the same thing — the row and the wedge are one fact said
twice, and a reader going down a list of numbers should not have to go back to the ring to
find which is which.

At rest nothing is emphasised. A ring that dims itself before anyone touches it looks broken.

The ring is **one** tab stop, not one per wedge: a chart that costs six presses to get past is
a chart people learn to skip. Keyboard focus produces the same reading the pointer does, and
announces it.

## Attributes, properties, methods

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `center-label` | string | `Total` | What the hole says when nothing is being read |
| `no-legend` | present | absent | For a page that supplies its own |
| `loading` | present | absent | Hold the ring at reduced opacity |
| `error` | string | — | Replace the ring with this message; the table stays |

| Member | Notes |
|---|---|
| `rows` | Every row read from the table |
| `slices` | What is actually drawn — at most six, with the tail folded |
| `total` | The sum of what is drawn |
| `refresh()` | Re-read the table after the page rewrites it |
| `labels` | Overrides every generated string |

## Marks

Two pixels of the surface separate the wedges, taken **out of** each wedge rather than drawn
on top, so they still add up to the whole circle. The gap is worked out in pixels and
converted to an angle, so it is the same width on a small ring as on a large one, and it is
clamped per wedge — a sliver is never spaced out of existence.

A single slice is a whole ring with **no** notch: a circle with a two-pixel bite out of it
reads as a rendering fault.

Never a stroke around a wedge. The gap is the mechanism; a stroke is ink with the weight of
data doing a spacer's job.

## Colour

The first six of the validated eight categorical slots, in the order that keeps every
neighbouring pair apart under colour-vision simulation. The last two are not defined here — a
token that exists is a token somebody will reach for, and a ring may not use them.

## Accessibility

- The table is the accessible content and stays in the page whether shown or collapsed.
- Each wedge is labelled with its name, value and share.
- Keyboard reading is announced through a `role="status"` region present and empty beforehand.
- A hidden row is struck through, so its state does not rest on colour.

## Reduced motion

`prefers-reduced-motion: reduce` removes the transitions. The wedge being read still comes out
of the ring — that is a position, not an animation — but it arrives there rather than
travelling.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `light-dark()`,
`color-mix()`, `ResizeObserver` and inline SVG.

## Files

| Path | Contents |
|---|---|
| `donut-chart.html` | Runnable example |
| `donut-chart.css` | Every style |
| `donut-chart.js` | The geometry, the custom element, and the demo bootstrap |
