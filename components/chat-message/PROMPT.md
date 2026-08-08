# Recreate Chat Message

You are a Senior Frontend Engineer. Build a Web Component named `<ui-chat-message>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

## Start from the thing that is invisible

Every chat interface says **who is talking** with position and colour, and a screen reader has
neither. Left alone, an entire conversation arrives as one block of text with nothing to say who
said what. Unlike most accessibility faults this one does not degrade the experience, it removes
the content.

So: **every message carries its speaker as a word**, said once in front of the content —
including the fourth bubble of a run, where nothing on screen names anybody. A run is a visual
grouping and somebody listening has no run to see.

Everything else follows:

- Hide the visible name and time from the accessibility tree. Both are already in that intro, and
  reading them again makes every message a stutter.
- Put `role="log"` on the **thread**, once — and leave the thread to the page. A page may hold
  several conversations and only the page knows which should announce itself. A live region per
  bubble means every arrival interrupts the one before it.
- Give every delivery state its **own glyph and its own word**. Two grey ticks against two blue
  ticks differ by colour alone, which is exactly what a state must not do.

## Work runs out from the neighbours

Consecutive messages from one person share an avatar and a timestamp. Read the neighbouring
messages and decide; do not ask the author to declare it. Keeping `first`/`last` attributes in
step as messages arrive is asking for them to be wrong.

Break a run on direction, on author, on a system notice, and **on a gap of more than a few
minutes** — without that last one a reply six hours later joins the run above and inherits a
timestamp from this morning.

## Reserve a picture's own shape, and check it on a cold load

Take `width` and `height`, set an `aspect-ratio`, and hold the box before anything arrives. Two
mistakes are easy here and both look correct:

- **Keep the image in the layout.** Hiding it and letting a skeleton size the bubble collapses
  it — measured at `512×225` becoming `104×98`, the exact jump you were preventing. Wrap the
  image in a frame and only make it `visibility: hidden`.
- **Give that frame a definite width.** A percentage against a shrink-wrapping bubble falls back
  to the content's intrinsic size, and an image that has not arrived has an intrinsic size of
  zero — so the frame collapses and `aspect-ratio` has nothing to multiply.

The second one is **invisible to any test that toggles a loading state on a cached image**. Block
the request and measure the box before the picture has ever existed, or you will ship a
reservation that does nothing on exactly the load it exists for.

Put the loading text **over** the placeholder, not under it: a line that comes and goes below the
picture moves everything after it.

Require `alt`. A picture message without it is a message with no content, and nothing says so.

## A voice note needs a transcript

Audio is not an accessible format and a waveform is not a substitute. Make the transcript part of
the contract, not an enhancement somebody remembers.

Mark the waveform `aria-hidden` and use a fixed pattern — one drawn to look like a real analysis,
for audio it never measured, is a picture that lies. Stop any other note when one starts.

## Shorten a quotation, and make it followable

Truncate at a word with an ellipsis: quoting a long message whole doubles the thread for anybody
reading it aloud. Make it a link to the original that moves **focus** as well as scroll — one
that only scrolls leaves a keyboard user where they were.

## Count four surfaces, not one

The page, their bubble, your bubble, and a quoted panel nested inside either. Your bubble is a
saturated accent, and that is where a "muted" ink misses `4.5` while looking perfectly fine.

**Give the quotation its own surface** rather than dimming text on the accent. In dark mode no
single blue holds both a 4.5 white and a 4.5 muted while still reading against the page.

Hold the bubble fill to something that reads as a shape rather than to a control's `3:1`. A
bubble is a grouping — you do not operate it, and nothing about the content depends on seeing its
edge, because the speaker is a word.

## Everything else

- `overflow-wrap: anywhere`, or one pasted URL pushes the bubble past the thread.
- A maximum bubble width. One that runs the full thread stops being a line of text.
- Civil time from a `datetime` attribute, never moved through a timezone.
- Pad the hour on a 24-hour clock and leave it bare on a 12-hour one. A fixed choice prints
  `03:40 PM` in one convention or `9:12` in the other.
- A failure keeps its receipt mid-run and offers a retry; the component asks, the page answers.

## Leave out

**The thread** — day dividers, scroll-to-bottom, an unread marker, the live-region policy. It has
to own the scroll container and is a component of its own. **The composer** produces a value;
this presents one.

## Verify before calling it done

Keep the speaker word, the run rule, the truncation and the time formatting runnable without a
browser.

- Every variant runs in an iframe with no external request and no overflow, wide and narrow.
- **Render it and look at it.**
- With scripting off, every variant is a complete conversation.
- Every message's spoken intro names its speaker, including run continuations.
- The thread has one live region and the messages have none.
- **Block the images and measure the box before they arrive.**
- Break an image: it says so, keeps its box, keeps its alt.
- Every voice note has a transcript; the waveform is hidden; one note stops another.
- A quotation is shorter than its source and moves focus when followed.
- Every delivery state draws a different glyph and carries a word.
- Re-measure every contrast floor on all four surfaces, in both themes, on exact ratios.
