# Recreate Chat Message as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-chat-message>` using plain
HTML, CSS, and JavaScript. No React, no TypeScript, no Tailwind runtime, no backend, no new
dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## The speaker is a word, not a side

Position and colour say who is talking, and a screen reader has neither — left alone the whole
conversation is one block of text with nothing to say who said what. Put the speaker in front of
every message as text, **including run continuations** where nothing on screen names anybody.

Hide the visible name and time from the accessibility tree; they are already in that intro. Put
`role="log"` on the thread once and leave the thread to the page — a live region per bubble means
every arrival interrupts the last. Give every delivery state its own glyph **and** its own word:
two grey ticks against two blue ticks differ by colour alone.

## Work runs out from the neighbours

Break a run on direction, author, a system notice, and a gap of more than a few minutes. Without
the gap a reply six hours later inherits a timestamp from this morning. Do not ask the author to
declare it.

## Reserve a picture's shape, and prove it on a cold load

Take `width` and `height` and set an `aspect-ratio`. Two traps, both of which look right:

- Keep the image in the layout inside a frame and only make it `visibility: hidden` — letting a
  skeleton size the bubble collapses it, which is the jump you were preventing.
- Give that frame a **definite** width. A percentage against a shrink-wrapping bubble falls back
  to intrinsic size, and an image that has not arrived is zero wide.

The second is invisible to any test that toggles a loading state on a cached image. **Block the
request** and measure before the picture has ever existed.

Put the loading text over the placeholder, not under it. Require `alt`.

## Output

```text
chat-message.html
chat-message.css
chat-message.js
README.md
```

The thread is ordinary markup: `<ol role="log">` with one message per item. Use `lang="en"`, and
say the page must be served over HTTP while noting the conversation is readable either way.

## The rules that matter

**A voice note needs a transcript** — audio is not an accessible format and a waveform is not a
substitute. Mark the waveform `aria-hidden` and use a fixed pattern; one drawn to look like a real
analysis for audio it never measured is a picture that lies. Stop other notes when one starts.

**Shorten a quotation** at a word with an ellipsis, and make it a link that moves focus as well as
scroll.

**Count four surfaces**: the page, their bubble, your bubble, and a quoted panel inside either.
Give the quotation its own surface rather than dimming text on a saturated accent, where "muted"
misses 4.5 while looking fine. Hold the bubble fill to reading as a shape rather than a control's
3:1 — the speaker is a word regardless.

**`overflow-wrap: anywhere`** and a maximum bubble width. **Civil time**, never moved through a
timezone; pad the hour on a 24-hour clock and leave it bare on a 12-hour one.

**A failure keeps its receipt** mid-run and offers a retry — the component asks, the page answers.

**Leave out the thread** (day dividers, scroll-to-bottom, unread marker) and the composer.

## Verify before delivering

- Open the network panel: nothing leaves the origin.
- **Look at it.**
- Turn scripting off: the conversation is all there.
- Check every message's spoken intro names its speaker, run continuations included.
- Block the images and measure the box before they arrive; then let them in and measure again.
- Break an image: it says so, keeps its box, keeps its alt.
- Confirm every voice note has a transcript and that one note stops another.
- Follow a quotation and check where focus ended up.
- Walk every delivery state and confirm each draws a different shape.
- Paste a long unbroken string into a bubble and narrow the window.
- Re-measure every contrast floor on all four surfaces, both themes, exact ratios.
