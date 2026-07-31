# Recreate Accordion

You are a Senior Frontend Engineer. Build a Web Component named `<ui-accordion>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

## The central instruction

**The widget is `details` and `summary`.** Do not rebuild it out of buttons and
`aria-expanded`. HTML already supplies the semantics, the open state, the keyboard, and —
through `name` on `details` — one panel open at a time, all of it working with scripting
turned off. Build the parts the platform has no answer for and leave the rest alone.

```html
<ui-accordion>
  <details>
    <summary>What the panel is about</summary>
    <p>Whatever should be inside it.</p>
  </details>
</ui-accordion>
```

Repair the markup rather than demanding it: supply a heading, a panel wrapper and a marker
where they are missing, and leave alone anything the author wrote.

## Variants

Build six, each teaching one thing.

- **Default**: a group of panels, one open to begin with.
- **Exclusive**: one open at a time.
- **Icons**: the marker at either end, a marker the author supplied, and a summary carrying
  secondary text.
- **Actions**: panels holding real content and a row of buttons along the foot.
- **States**: a disabled panel, one open by default, and one long enough to scroll.
- **Controlled**: opened and closed from outside, with every change reported back.

## The press is where the animation hangs

This is the fact the whole component is built around, and getting it wrong fails silently —
the panel still opens and closes, it simply jumps, and nothing is reported anywhere.

- `toggle` on `details` **cannot be cancelled** and arrives **after** `open` has changed.
- `details` has **no `beforetoggle`**.
- `click` on `summary` **can** be cancelled, and refusing it keeps the panel shut.

So intercept the press, refuse it, and drive `open` yourself.

## Closing has to keep the panel open

A closed `details` does not render its content, and nothing that is not rendered can be
animated. Set the height to zero first and only set `open = false` when the movement ends.

Two steps, as always: put the panel where it starts with the transition switched off, let the
layout settle, then switch it back on and send it to where it ends.

Run a timer alongside `transitionend`. A transition that never starts never ends either — a
panel of zero height, a tab in the background — and the panel would be left frozen at an
inline height, unable to resize with its content again.

**Make the length follow the distance**, floored and capped. One speed for every panel is
wrong at both ends: a two-line panel crawls and a long one drags.

## One panel at a time, handed over rather than taken

The browser closes a named sibling itself, instantly, with no event to hang an animation off.
So **remove the `name` when the element loads** and enforce the rule yourself. Until that
line runs the browser was doing the job, which is exactly what should happen.

Treat a `name` in the markup as `exclusive` even without the attribute, so the behaviour does
not change at the moment the script arrives.

In this mode, opening everything opens the **first panel and no more**. A group whose rule is
one at a time cannot be left in a state that rule forbids, or the next press appears to do
nothing.

## A heading for every summary

A summary is a button to the accessibility tree and nothing else, and moving between headings
is how most screen reader users move through a page of panels. Supply one at a configurable
level, defaulting to `h3`.

**Lift the marker and the secondary text out of the summary before building the heading**,
because building it sweeps up whatever is left:

- A marker left in place ends up inside the heading, where the check for one no longer finds
  it, and a second is drawn beside it.
- The heading names the panel through `aria-labelledby`, so secondary text swept into it
  becomes part of that name.

## The panel is two boxes

An outer one whose height moves and an inner one that keeps its natural height, so there is
something to move towards. **Create the inner one even when the author supplied the outer
one.** Measuring the first child instead is right for a panel with exactly one child and
quietly wrong for every other: the panel opens to the height of its first paragraph.

## `role="region"`, but only while it helps

Name each panel with its heading through `aria-labelledby` and give it `role="region"` — and
then stop. The Authoring Practices asks for the role and warns against breeding landmarks
with it, giving "more than approximately six" as the number. Follow both halves and let the
count decide.

## A disabled panel keeps its tab stop

`aria-disabled` on the summary and the press refused. Do **not** take it out of the tab order:

- A header nobody can reach is a header nobody can discover is unavailable.
- A disabled element cannot hold focus at all, so turning one off under somebody's finger
  drops focus to the body and takes the keyboard with it.

Hide the marker as well as changing the colour, so the state is never carried by colour
alone. Refuse the API too, not only the press.

## Keyboard

`ArrowUp` and `ArrowDown` between headers, wrapping at both ends; `Home` and `End` for the
first and last. Only while focus is on a summary — inside a panel the arrows belong to
whatever is in there. **Land on a disabled header rather than stepping over it.**

## Report the decision, not the DOM

Emit an event per panel that moved and one for the group, when the change is decided rather
than when the animation ends, and carry the state that was decided. Reading the elements at
that moment reports a closing panel as still open for the whole of the time it spends
closing, because that is exactly how the close works.

Say what caused the change — a press or a call — so a consumer can tell them apart.

## Announce only what nobody asked for

Closing the panel you just pressed needs no telling; a native summary already reports its own
name and state. The panel that closed itself somewhere else on the page does, so announce
that one politely through a `role="status"` region that is present and empty beforehand.

## Presentation

- Replace the native disclosure triangle rather than styling it: it cannot be moved, sized,
  or turned, and every browser draws it differently.
- Move the marker by **reordering**, not by moving it in the markup, so the title stays first
  in the reading order on both sides.
- Turn the marker as the panel opens.
- `prefers-reduced-motion: reduce` removes every transition, in the stylesheet **and** in the
  element, which must skip its own two steps so nothing is left at an inline height.
- Define every CSS custom property the component reads inside the component itself.

## Verify before calling it done

Keep the rules that decide things — the heading level, the region threshold, the duration,
the next header, which panels end up open — reachable without a browser.

Check these explicitly, because each is a place this component quietly goes wrong:

- With scripting disabled the panels still open, close, and report their state.
- The first frame after a press is near zero. If it is the full height, the press was not
  intercepted and the panel is jumping.
- A panel passes through real intermediate heights in **both** directions, and is left with
  no inline height afterwards.
- A closing panel stays `open` for the whole of its movement.
- Exclusive mode has no `name` left on any panel and announces the one that closed itself.
- A disabled panel refuses the press **and** the API, and still takes focus.
- Arrow keys wrap and land on the disabled header.
- Panels stop being landmarks above six.
- A panel whose content is more than one element opens to its full height.
- Secondary text is not part of the name of the region.
- Reduced motion leaves no inline height behind.
