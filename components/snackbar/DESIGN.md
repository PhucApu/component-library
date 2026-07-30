# Snackbar - Design Specification

## 1. Purpose

Report what just happened, without taking the person away from what they are doing.

## 2. A different kind of component

Every other component in this collection is a control: the author writes it into the page,
the person operates it, and it reports a value. A snackbar inverts all three. The
application summons it in code, it happens *to* the person rather than being operated by
them, and it reports nothing back because it **is** the report.

So the API is a method, not an element with attributes. `<ui-snackbar>` is placed once as a
host and never edited again.

## 3. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog.

| Token | Value | Role |
|---|---|---|
| `--snackbar-surface` | `#1f2430` | Message background |
| `--snackbar-text` | `#f4f6fa` | Message text |
| `--snackbar-border` | `#6b7484` | Edge against the page |
| `--snackbar-action` | `#a8c0ff` | Action label |
| `--snackbar-info` | `#86a0ff` | Information icon |
| `--snackbar-success` | `#6ee7a8` | Success icon |
| `--snackbar-warning` | `#fbbf5c` | Warning icon |
| `--snackbar-error` | `#ff8e87` | Error icon |
| `--snackbar-radius` | `12px` | Corner radius |

## 4. Anatomy

Three parts, deliberately separate:

1. A `role="status"` region, visually hidden, empty at rest.
2. A `role="alert"` region, the same.
3. The visible surface, holding an icon, the message, an optional action, and dismiss.

## 5. Why the live regions are permanent and separate

**Permanent**, because a live region created together with its first message is routinely
never announced: assistive technology has to be watching the node before the text arrives.
Both regions are in the document from the moment the element connects.

**Separate**, because politeness cannot be changed reliably at runtime. Rather than
rewriting `aria-live` on one region, there are two, and the message is written into
whichever matches its severity.

Writing into a region that already holds text announces nothing, so both regions are
emptied whenever a message closes and again before the next one is written. **The emptying
is what carries this**, and it is what the test watches: a naive implementation that simply
overwrites the text still changes the DOM, so asserting that the text changed would prove
nothing.

The `60ms` pause before writing is narrower in purpose than it first looks. The queue
normally separates a close from the next message by the exit transition anyway. It earns
its place under `prefers-reduced-motion: reduce`, where the exit completes immediately and
the clear and the next write would otherwise land in adjacent tasks.

## 6. `aria-hidden` on the paragraph, never on the surface

The live region carries the sentence, so the visible paragraph would say everything twice.
It is marked `aria-hidden`.

That attribute must not move up to the surface. An `aria-hidden` ancestor removes its
descendants too, which would take the action button out of the accessibility tree entirely.

Measured in Chromium: with the paragraph hidden, `Undo` and `Dismiss` are both present as
named buttons, and the sentence appears exactly once.

## 7. Severity decides how loudly it speaks

| Severity | Region | Reasoning |
|---|---|---|
| `info`, `success` | `role="status"` | Waits for a pause in the conversation |
| `warning`, `error` | `role="alert"` | Interrupts; a problem heard too late is no use |

Derived from the severity rather than set separately, so the two cannot disagree.

The icon changes **shape** as well as colour, so the kind of message survives for anyone
who cannot separate the two hues.

## 8. Nothing you can act on runs a clock

A message offering an action has no timer at all. A button that disappears on a clock loses
the race against anyone still reading the sentence, and against anyone reaching it by
keyboard at all. It closes when the person chooses.

For messages with nothing to act on, the timer stops when the pointer rests on the surface,
when focus moves inside it, and when the tab goes to the background. It then resumes with
the time that was **left**, not a fresh window.

Because an action-bearing message never expires, the application should still offer the
same action somewhere permanent. The snackbar is a shortcut, not the only route.

## 9. One at a time, and urgency jumps the queue

Messages queue rather than stack. Two live regions updating together trample each other and
the reader hears neither in full.

Plain first-in first-out was not enough. It left an error waiting out the whole life of the
"Saved" message in front of it, which contradicts the point of marking it assertive. So an
urgent message goes to the front and displaces a calm one on screen, reported as
`preempted`. A calm message never displaces an urgent one, and one urgent message waits for
another to finish.

## 10. Escape only from inside

The surface listens for Escape, so it closes only while focus is within it. A
document-level listener would take Escape away from any dialog, picker, or combobox open on
the same page — including two components in this collection.

## 11. Focus is never taken

Showing a message does not move focus. The action is reachable by keyboard because the
message waits indefinitely, not because it grabs attention.

## 12. Placement and the top layer

Six anchors, named by logical edge — `start` and `end` rather than left and right — so they
follow the writing direction. The surface uses the Popover API for the top layer, which
avoids competing on `z-index` with anything else on the page. Below `30rem` every placement
spans the full width.

## 13. Contrast and motion

Measured on the demo surface: message text `14.34:1`, action label `8.61:1`, icons between
`6.27:1` and `10.09:1`, and the surface edge `4.01:1` against the page.

The message travels `1.5rem`, fading and scaling from `0.96` as it goes: `280ms` on a soft
ease-out coming in, `170ms` ease-in going out. Leaving faster than arriving is the point —
a message should take its time appearing and get out of the way promptly.

**It arrives out of the edge it is pinned to.** A corner slides in sideways; only the
centred anchors travel vertically:

| Anchor | Arrives from |
|---|---|
| `top-start`, `bottom-start` | The inline-start edge |
| `top-end`, `bottom-end` | The inline-end edge |
| `top-center` | Above |
| `bottom-center` | Below |

The sideways travel is signed by writing direction, so `start` always means the start edge
rather than the left one. Measured in RTL, `top-start` arrives from the right and
`bottom-end` from the left — the mirror of the same table.

Getting the arrival to animate at all took two attempts. The first version put the open
state on a single attribute and leaned on `@starting-style`. Traced frame by frame it never
moved: `opacity` was already `1` on the first frame and no animation was running, while the
exit worked perfectly. The fix is a two-step reveal — one attribute renders the surface at
its starting values, a layout read flushes that, and a second attribute moves it into
place. `showPopover()` forces the same flush as it happens, so the explicit read is what
keeps the arrival animating in a browser without the Popover API.

`prefers-reduced-motion: reduce` removes all of it, and the exit completes immediately so
nothing waits on an animation that is not running.

## 14. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Action variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 15. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- Both live regions are present and empty before any message is raised.
- A message with an action does not expire; one without it does.
- Showing a message never moves focus.
- Escape closes only from inside the surface.
- Hover, focus, and a hidden tab each hold the message, resuming with the remaining time.
- Messages raised together arrive one at a time, and each is announced.
- An urgent message displaces a calm one; the reverse never happens.
