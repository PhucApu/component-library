# Accordion - Design Specification

## 1. Purpose

A group of disclosure panels. One of the few widgets HTML already ships whole, so the work is
deciding what to leave alone.

## 2. The widget is `details` and `summary`

Not a rebuild of one. The platform already supplies the semantics, the open state, the
keyboard, and — through `name` — one panel open at a time. All of it works with scripting
turned off.

This is the sixth component in the collection built by improving something that exists rather
than replacing it, after Radio Group, Text Field, Switch, Table and Breadcrumbs. The
alternative, a `button` carrying `aria-expanded` and `aria-controls`, is what the Authoring
Practices describes and what Material UI builds. It would have thrown away the fallback and
bought nothing that could not be had another way.

## 3. What the platform does not do

| | |
|---|---|
| Animate | A `details` snaps |
| Head the summary | It is a button and nothing else in the accessibility tree |
| Make the panel a region | Nothing to jump to |
| Arrow keys between headers | |
| Turn a panel off | `summary` has no `disabled` |
| Report why something changed | |

## 4. Visual tokens

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--accordion-surface` | `#ffffff` | `#171a20` | The group and the panels |
| `--accordion-summary` | `#f7f8fa` | `#1a1e26` | The header |
| `--accordion-summary-hover` | `#eef1f5` | `#20252f` | The header under the pointer |
| `--accordion-text` | `#111827` | `#f4f6fa` | Titles |
| `--accordion-muted` | `#5f6878` | `#a8afbc` | Body copy, secondary text, the marker |
| `--accordion-border` | `#dfe4ec` | `#2e3440` | The outline and the rules between panels |
| `--accordion-accent` | `#4f46e5` | `#86a0ff` | Links and the primary action |
| `--accordion-focus` | `#6366f1` | `#86a0ff` | The focus ring |
| `--accordion-on-accent` | `#ffffff` | `#10131a` | The primary action's label |
| `--accordion-radius` | `12px` | | |

The accent is dark in one theme and light in the other, so the primary action's label
travels with it through `--accordion-on-accent` rather than naming a colour of its own.
Its hover lightens the accent by mixing 12% white into it, which still leaves the label at
`4.95:1` on the light theme's indigo.

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

Measured: title on the header `15.43:1`, body copy on the panel `7.9:1`, the marker `7.57:1`,
and a disabled title on the header `7.57:1`. The rules ask for `4.5:1` on text and `3:1` on a
user interface boundary.

## 5. The press is where the animation hangs

Measured, and the single fact the whole component is built around:

| | |
|---|---|
| `toggle` on `details` | `cancelable: false`, and it arrives **after** `open` has changed |
| `beforetoggle` on `details` | Does not exist |
| `click` on `summary` | `cancelable: true`, and `preventDefault()` keeps it shut |

So the press is intercepted and the element drives `open` itself. Anything later is too late:
by the time `toggle` fires there is nothing left to animate from.

This is a silent trap. Leave the press alone and the panel still opens and closes — it simply
jumps, and no error is reported anywhere.

## 6. Closing has to keep the panel open

A closed `details` does not render its content, and nothing that is not rendered can be
animated. So closing sets the height to zero first and only sets `open = false` when the
movement is over.

The two steps are the usual ones: put the panel where it starts with the transition switched
off, let the layout settle, then switch it back on and send it to where it ends.

A timer runs alongside `transitionend`, because a transition that never starts never ends
either — a panel of zero height, or a tab in the background — and the panel would be left
frozen at an inline height, unable to resize with its content ever again.

## 7. One panel at a time, handed over rather than taken

The browser closes a named sibling itself, instantly, with no event to hang an animation off.
So the element removes the `name` when it loads. Until that line runs the browser was doing
the job, which is exactly what should happen; afterwards the element does it, with the
movement.

A `name` in the markup therefore counts as `exclusive` even without the attribute. That is
not two ways of saying the same thing — it stops the behaviour changing at the moment the
script arrives, which would be the worst of both.

`expandAll()` in this mode opens the first panel and no more. A group whose rule is one at a
time cannot be left in a state that rule forbids, or the next press appears to do nothing.

## 8. Duration follows the distance

One speed for every panel is wrong at both ends: a two-line panel crawls and a long one
drags. The length is proportional to how far the panel has to travel, floored at `120ms` and
capped at `420ms`. `duration` overrides it.

## 9. A heading for every summary

A summary is a button to the accessibility tree and nothing more, and moving between headings
is how most screen reader users move through a page of panels. One is supplied where the
author has not written one, at `heading-level`, which defaults to `h3`.

Two things are lifted out of the summary before the heading is built, because building it
sweeps up whatever is left:

- **The marker.** Left in place it ends up inside the heading, where the check for one no
  longer finds it — and a second is drawn beside it. Found by looking at the rendered page,
  not by a failing test.
- **The secondary text.** The heading names the panel through `aria-labelledby`, so anything
  swept into it becomes part of that name: the region for "Invoice 4021" would have been
  called "Invoice 4021 Paid 14 March".

## 10. The panel is two boxes

An outer one whose height moves, and an inner one that keeps its natural height so there is
something to move towards. The inner one is created even when the author supplied the outer
one: measuring the first child instead would be right for a panel with exactly one child and
quietly wrong for every other — the panel would open to the height of its first paragraph.

## 11. `role="region"`, but only while it helps

The Authoring Practices asks for the role so a panel can be jumped to, then warns against
using it where it would breed landmarks — "more than approximately six" is the number it
gives. Both halves are followed, so the count decides: six panels or fewer and the panels are
landmarks; more and they are not.

## 12. A disabled panel keeps its tab stop

`aria-disabled` on the summary, and the press refused. Nothing that removes it from the tab
order, for two reasons:

- A header nobody can reach is a header nobody can discover is unavailable.
- **A disabled element cannot hold focus.** Turning one off under somebody's finger drops
  focus to the body and takes the keyboard with it. That has happened four times in this
  collection — Switch's pending state, Pagination's ends, the Lightbox's opening focus, and
  its zoom controls — so here the shape is avoided rather than handled.

The marker is hidden as well as the colour changed, so nothing suggests the panel would open.

## 13. Events report the decision, not the DOM

Both events fire when the change is decided and carry the state that was decided. Reading the
elements instead would report a closing panel as still open for the whole of the time it
spends closing, because that is exactly how the close animation works. Found by a test.

## 14. What the person did not ask for is announced

Closing the panel you just pressed needs no telling. The panel that closed itself somewhere
else on the page does, so exclusive mode announces that one politely through a `role="status"`
region that is present and empty beforehand.

Nothing else is announced. A native summary already reports its own name and whether it is
open, and repeating that would be noise.

## 15. Motion

The height over `120ms`–`420ms`, the marker turning over `200ms`, the header colour over
`140ms`. `prefers-reduced-motion: reduce` removes all of it, in the stylesheet and in the
element, which skips its own two steps so the panel arrives at once rather than travelling
instantly and leaving an inline height behind.

## 16. Responsive behaviour

Below `34rem` the padding tightens and the secondary text goes rather than squeezing the
title, which is the part that says which panel this is.

## 17. Variants

| Variant | What it is for |
|---|---|
| Default | The group, and what the component adds over the platform |
| Exclusive | One at a time, before the script and after it |
| Icons | The marker at either end, a supplied icon, secondary text |
| Actions | Panels holding real content and a row of buttons |
| States | Disabled, open by default, and long enough to scroll |
| Controlled | Driven from outside, with every change reported |

## 18. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 19. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the panels still open, close, and report their state.
- A panel passes through real intermediate heights rather than jumping, in both directions,
  and is left with no inline height afterwards.
- A closing panel stays `open` until its movement is over.
- The first frame after a press is near zero, which is what proves the press was intercepted.
- Exclusive mode leaves one panel open, has no `name` left on any panel, and announces the
  one that closed itself.
- A disabled panel refuses both the press and the API, and still takes focus.
- Arrow keys wrap, land on a disabled header, and leave the panel contents alone.
- Panels stop being landmarks above six.
- Reduced motion removes the movement and leaves no inline height.
