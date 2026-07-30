# Recreate Snackbar

You are a Senior Frontend Engineer. Build a Web Component named `<ui-snackbar>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

## The central instruction

This is not a control. Nobody writes a snackbar into a page and nobody operates it: the
application summons it, it happens to the person, and it reports nothing back because it
**is** the report.

So the public surface is a method, not a set of attributes. The element is placed once as a
host and never edited again.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement
is configuration, not a separate build.

- **Default**: plain messages raised from buttons, leaving focus where it was.
- **Severity**: all four levels, information and success waiting their turn while warning
  and error interrupt.
- **Action**: messages offering Undo and Retry, which run no timer, beside one that clears
  itself.
- **Placement**: the six anchors.
- **Queue**: four messages raised at once, arriving one at a time in order.
- **Timing**: a short message, a long one, and one that waits to be dismissed, with hover
  and focus holding the clock.

Each has to run on its own, loading nothing from another origin.

## Public API

```js
snackbar.show({ message, severity, duration, action: { label, onSelect } });
```

Support `placement` as an attribute, taking `top-start`, `top-center`, `top-end`,
`bottom-start`, `bottom-center`, and `bottom-end`. Expose `current`, `pending`, and
`labels` as properties, plus `show()` returning an id, `dismiss(id)`, and `clear()`.

Report through:

```js
new CustomEvent('snackbar-show', { detail: { id, message, severity }, bubbles: true, composed: true });
new CustomEvent('snackbar-dismiss', { detail: { id, reason, severity }, bubbles: true, composed: true });
```

`reason` is `timeout`, `action`, `dismiss`, `clear`, or `preempted`. Knowing whether someone
chose Undo or simply let the message go is information nothing else provides.

## The three parts, deliberately separate

1. A visually hidden `role="status"` region.
2. A visually hidden `role="alert"` region.
3. The visible surface: icon, message, optional action, dismiss.

**Both regions exist from the moment the element connects, and stay empty.** A live region
created together with its first message is routinely never announced; assistive technology
has to be watching the node before the text arrives. This is the single most common way a
toast silently fails.

Two regions rather than one, because politeness cannot be changed reliably at runtime.
Write the message into whichever matches its severity.

Writing into a region that already holds text announces nothing, so empty both regions when
a message closes and again before writing the next. Add a short pause before the write as
well: with reduced motion the exit finishes immediately, and the clear and the next write
would otherwise land in adjacent tasks.

## `aria-hidden` on the paragraph, never on the surface

The live region carries the sentence, so the visible paragraph would say everything twice
and is marked `aria-hidden`. That attribute must not move up to the surface: an
`aria-hidden` ancestor removes its descendants, which would take the action button out of
the accessibility tree entirely.

## Severity decides how loudly it speaks

`info` and `success` go to the polite region; `warning` and `error` go to the assertive
one. Derive this from the severity rather than offering it separately, so the two cannot
disagree. Change the icon **shape** as well as its colour.

## Timing

A message carrying an action runs **no timer at all**. A button that disappears on a clock
loses the race against anyone still reading the sentence, and against anyone reaching it by
keyboard at all.

Everything else defaults to five seconds, where `0` means until dismissed. The clock stops
while the pointer rests on the surface, while focus is inside it, and while the tab is
hidden, then resumes with the time that was **left** rather than starting over.

## One at a time, and urgency jumps the queue

Queue rather than stack: two live regions updating together trample each other and the
reader hears neither in full.

Plain first-in first-out is not enough. It leaves an error waiting out the whole life of the
"Saved" message in front of it, which contradicts the point of marking it assertive. An
urgent message goes to the front and displaces a calm one on screen. A calm message never
displaces an urgent one, and one urgent message waits for another to finish.

## Presentation and accessibility

- Never move focus when a message appears. The action is reachable because the message
  waits indefinitely, not because it grabs attention.
- Listen for Escape on the surface, so it closes only while focus is inside. A
  document-level listener would take Escape away from any dialog or picker on the same page.
- Name the anchors by logical edge, `start` and `end` rather than left and right, so they
  follow the writing direction.
- Put the surface in the top layer with the Popover API rather than competing on `z-index`.
- Below `30rem` every placement spans the full width.
- Message text and the action label reach `4.5:1`; the icon and the surface edge reach
  `3:1` against what is behind them.
- The message travels `1.5rem`, fading and scaling from `0.96`: `280ms` easing out on the
  way in, `170ms` easing in on the way out. Leaving faster than arriving is deliberate.
- **It arrives out of the edge it is pinned to.** The two start anchors slide in from the
  inline-start edge, the two end anchors from the inline-end edge, and only the centred
  anchors travel vertically — down from the top, up from the bottom. Sign the sideways
  travel by writing direction so `start` never quietly means "left".
- **Reveal in two steps.** One attribute renders the surface at its starting values, a
  layout read flushes that change, and a second attribute moves it into place. Applying
  both in one recalculation leaves the transition nothing to start from and the message
  simply appears — and `@starting-style` alone does not rescue it on a popover. Trace the
  opacity frame by frame to confirm, because every check of the settled state passes
  either way.
- Under `prefers-reduced-motion: reduce` remove the motion, and let the exit complete
  immediately so nothing waits on an animation that is not running.
- Define every CSS custom property the component reads inside the component itself, and
  reference nothing outside it. That is what lets the snackbar be lifted into another
  project unchanged.

## Verify before calling it done

Keep the rules that decide things — normalising a severity, mapping it to a politeness,
working out a duration, composing the announced sentence, ordering the queue — reachable
without a browser, so they can be tested on their own.

Check these explicitly, because each is a place this component quietly goes wrong:

- Both live regions are present and empty before any message is raised.
- The action button keeps its accessible name while the paragraph beside it is hidden, and
  the sentence appears exactly once in the accessibility tree. Read the tree the browser
  actually exposes rather than trusting the attributes.
- A message with an action is still on screen well past the default window; one without an
  action is gone.
- Showing a message does not move focus.
- Escape from inside closes it; Escape from elsewhere on the page does not.
- Hover holds the message, and releasing resumes rather than restarting.
- Four messages raised together arrive in order, and the live region goes back to empty
  between them. Watch the sequence of writes, not the final text: a naive implementation
  that overwrites the region still changes the text, so asserting on the text alone passes
  either way.
- An urgent message displaces a calm one, and a calm one never displaces an urgent one.
- Every route out reports its own reason.
