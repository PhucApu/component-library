# Recreate Stat Tile as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-stat-tile>` using plain
HTML, CSS, and JavaScript. No React, no TypeScript, no Tailwind runtime, no backend, no new
dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## What it is

The headline number on an admin dashboard — a value, its change, an optional sparkline, an
optional meter against a limit. It is **not a one-bar bar chart** and **not a two-slice pie**;
both spend chrome saying what the number already said.

The label, the value and the change are **ordinary paragraphs that need no script**. Only the
sparkline is drawn. `data-value` carries the number, the text carries the wording, and the
component **never reformats the text** — it cannot know whether the reader expects `1.28M`,
`1,28 Mio` or `128 万`.

Put the meter's ceiling in markup as well, not an attribute: an attribute needs a second
attribute for its wording.

## Output

```text
stat-tile.html
stat-tile.css
stat-tile.js
README.md
```

- `stat-tile.js` is one ES module holding the rules and the element, defining it only when it
  is not already registered.
- `stat-tile.css` holds every style, including the row layout for consumers to copy.
- `README.md` documents the markup, the attributes, and **the two things it refuses to be**.

Use `lang="en"`. ES modules do not load from `file://`, so say the page must be served — while
noting the headline is readable either way.

## The rules that matter

**Direction is a fact; judgement is the author's.** Read the sign for the arrow, take
`up` (`good` | `bad` | `neutral`) for the meaning. Costs up and revenue up are the same arrow
and opposite news. Zero shows no arrow and says `no change`.

**Colour is the third signal, never the first.** Arrow, word, colour. Hold the delta ink to
`4.5:1` on both surfaces and check it — a status *fill* is usually too light to be a word.

**The meter's track is the fill's own hue mixed into the surface**, not grey. Measure fill
against track, and expect amber on a light surface to fail at about `1.70` with no lighter step
able to pass. Do not reach for grey; **state the condition in words** in every state that has
one, so nothing rests on the bar's colour. A quota already past fills the bar and stops there.
Announce it as a `meter` with min, max and current.

**The sparkline** has no axis, no grid and no labels. A flat run goes through the middle, not
along the floor. A single reading draws nothing. Keep the readings in the page, visually
hidden, with no toggle — the value and the change are on screen already.

**A row of tiles is layout, not a component.** Ship the CSS, using `subgrid` so every label,
value and change lines up across tiles. Do not build a wrapper element: it would invite a
filter per card, when one filter row above everything is the rule.

**Typography.** Proportional figures on the value — `tabular-nums` makes `1,284` look loose at
display size — and tabular on the change, which is a column. The hero is the same sans,
larger, and there is exactly one per view.

Ship `refresh()`, because the numbers live in text nodes and a page that rewrites one has
changed the data invisibly. Ship no events.

## Verify before delivering

Serve the folder over HTTP and check each by hand.

- Open the network panel: nothing leaves the origin.
- **Look at it.**
- Turn scripting off: label, value and change are all readable.
- Set `up="bad"` on a rise: the colour and only the colour changes meaning — the arrow and the
  word are still there.
- Set a change of zero: no arrow.
- Fill a meter past its limit: the bar stops, the numbers do not.
- Give a tile one reading: no sparkline.
- Put four tiles in a row: the lines agree.
- `hidden` is an `HTMLElement` property and does nothing on an SVG node — hide SVG parts with
  the attribute.
