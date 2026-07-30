# Recreate Snackbar as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-snackbar>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework,
a backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It
is self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

This is not a control. Nobody writes a snackbar into a page and nobody operates it: the
application summons it, it happens to the person, and it reports nothing back because it
**is** the report.

So the public surface is a method, not a set of attributes. The element is placed once as a
host and never edited again.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
snackbar.html
snackbar.css
snackbar.js
README.md
```

- `snackbar.js` is one ES module holding the DOM-free rules, the custom element, and the
  demo bootstrap. It defines the element only when it is not already registered.
- `snackbar.css` holds every style, driven by component-owned CSS custom properties.
- `snackbar.html` is a runnable example raising plain messages, all four severities, one
  with an Undo action, and a burst of four at once, reporting events into an `<output>`.
- `README.md` documents the options, the event detail, the timing rules, and browser
  support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the
page must be served over HTTP or HTTPS.

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

Give each severity a soft tinted surface carrying strong text rather than a saturated
fill, which is how a message this size fails contrast. Derive the border by pulling the
text colour towards the surface — that darkens the edge on a light theme and lightens it
on a dark one, so one rule keeps it perceivable in both. Let the icon, the action label,
and the dismiss button all take the same text colour, and set the action apart by weight
and an underline.

## Timing

A message carrying an action runs **no timer at all**. A button that disappears on a clock
loses the race against anyone still reading the sentence, and against anyone reaching it by
keyboard at all. Document that the application should still offer the same action somewhere
permanent.

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
  `3:1` against what is behind them. Beware that `color-mix()` computes to
  `color(srgb r g b)` with `0-1` channels rather than to `rgb()`: a contrast check that
  reads colours with a plain digit match turns that into a ratio in the hundreds of
  millions, which is a threshold that can never fail.
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

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- The accessibility inspector shows both live regions present and empty before anything is
  raised.
- A message with an action is still there a minute later; one without it has gone.
- The action button has a name, and the sentence is not read twice.
- Showing a message does not move the focus ring.
- Escape closes it only while focus is inside the message.
- Resting the pointer on a message holds it, and moving away resumes rather than restarts.
- Raising four together shows them one at a time, in order.
- Raising an error while a success is on screen replaces it immediately.
