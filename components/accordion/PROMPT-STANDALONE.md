# Recreate Accordion as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-accordion>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It
is self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

**The widget is `details` and `summary`.** Do not rebuild it out of buttons and
`aria-expanded`. HTML already supplies the semantics, the open state, the keyboard, and —
through `name` on `details` — one panel open at a time, all with scripting turned off. Build
only what the platform has no answer for.

## Output

Produce exactly these, flat:

```text
accordion.html
accordion.css
accordion.js
README.md
```

- `accordion.js` is one ES module holding the DOM-free rules, the custom element, and the
  demo bootstrap. It defines the element only when it is not already registered.
- `accordion.css` holds every style, driven by component-owned CSS custom properties.
- `accordion.html` is a runnable example with a plain group, an exclusive group, a disabled
  panel, and a panel holding a row of buttons.
- `README.md` documents the markup contract, the attribute table, the keyboard, and browser
  support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page
must be served over HTTP or HTTPS, while noting the panels would still open.

## Markup contract

```html
<ui-accordion>
  <details>
    <summary>What the panel is about</summary>
    <p>Whatever should be inside it.</p>
  </details>
</ui-accordion>
```

Repair rather than demand: supply a heading, a panel wrapper and a marker where they are
missing, and leave alone anything the author wrote.

## Public API

Support `exclusive`, `heading-level` (2–6), `icon-placement` (`start`/`end`) and `duration`
as attributes, and `data-disabled` on a panel. Expose `items`, `expanded`, and `labels`, plus
`expand()`, `collapse()`, `toggle()`, `expandAll()` and `collapseAll()`. Emit
`accordion-toggle` and `accordion-change`, each saying whether a press or a call caused it.

## The press is where the animation hangs

Getting this wrong fails silently: the panel still opens and closes, it simply jumps.

- `toggle` on `details` **cannot be cancelled** and arrives **after** `open` has changed.
- `details` has **no `beforetoggle`**.
- `click` on `summary` **can** be cancelled, and refusing it keeps the panel shut.

Intercept the press and drive `open` yourself.

## Closing has to keep the panel open

A closed `details` does not render its content, and nothing unrendered can be animated. Set
the height to zero first and only set `open = false` when the movement ends. Two steps: place
it with the transition off, flush the layout, then transition to the end. Run a timer
alongside `transitionend`, because a transition that never starts never ends and would leave
the panel frozen at an inline height.

Make the length follow the distance, floored around `120ms` and capped around `420ms`.

## One panel at a time

Remove the `name` when the element loads and enforce the rule yourself, so the close can be
animated — until that line runs, the browser was doing the job. Treat a `name` in the markup
as `exclusive` even without the attribute, so nothing changes when the script arrives.
Opening everything in this mode opens the first panel and no more.

Announce the panel that closed itself, politely, through a `role="status"` region present and
empty beforehand. Do not announce the panel that was pressed — a native summary already
reports its own name and state.

## A heading for every summary

A summary is a button and nothing else in the accessibility tree, and headings are how most
screen reader users move through a page of panels. Supply one at `heading-level`.

**Lift the marker and any secondary text out before building the heading**, because building
it sweeps up whatever is left: a marker inside the heading is a marker the check no longer
finds, and a second gets drawn; secondary text inside the heading becomes part of the name of
the region the heading labels.

## The panel is two boxes

An outer one whose height moves, an inner one at its natural height. Create the inner one
even when the author supplied the outer one — measuring the first child is right for a panel
with one child and quietly wrong otherwise.

## Accessibility

- Name each panel with its heading and give it `role="region"` — but only while the group has
  six panels or fewer. The Authoring Practices asks for the role and warns against breeding
  landmarks with it.
- A disabled panel keeps `aria-disabled` and its tab stop. A header nobody can reach is a
  header nobody can discover is unavailable, and a disabled element cannot hold focus at all.
  Hide its marker so the state is not colour alone. Refuse the API as well as the press.
- `ArrowUp`/`ArrowDown` between headers, wrapping; `Home`/`End` for the ends; only while
  focus is on a summary. Land on a disabled header rather than stepping over it.
- Replace the native disclosure triangle; move the marker by reordering so the title stays
  first in the reading order.
- `prefers-reduced-motion: reduce` removes every transition, in the stylesheet and in the
  element, which must skip its own two steps.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Turn scripting off: the panels still open and close.
- Press a summary and watch the first frame: near zero, not the full height.
- Open and close: real intermediate heights both ways, and nothing left at an inline height.
- Exclusive: no `name` left on any panel, and the one that closed itself is announced.
- The disabled panel refuses the press and the API, and still takes focus.
- Tab to a header and press the arrows: they wrap, and they stop at the panel boundary.
- Open a panel holding several elements: it reaches its full height, not its first
  paragraph's.
