# Chat Message - Design Specification

## 1. Purpose

One bubble in a conversation, in the forms a conversation actually takes: words, a picture, a
quoted reply, a voice note, a file. `data-display`, because a message is content to read — the
composer that writes one is an input, and is not this.

## 2. Which side the bubble sits on is invisible

The decision everything else follows from.

Every chat interface encodes **who is talking** as position and colour. A screen reader has
neither. Without help, an entire conversation arrives as one block of text with nothing to say
who said what — and unlike most accessibility faults, this one does not degrade the experience,
it removes the content.

So every message carries its speaker as a **word**, said once in front of the content:

```text
Mai, 09:12    Are we still on for three?
You, 09:15    Three works. I'll bring the printouts.
Mai, 09:12    I can move it if that suits you better.   ← name hidden on screen, still said
```

The fourth bubble of a run shows no name. A run is a visual grouping and somebody listening has
no run to see, so the intro is on every message without exception.

Consequences that follow from it:

- The visible name and the visible time carry `aria-hidden`. Both are already in the intro, and
  reading them again makes every message a stutter.
- `role="log"` belongs on the **thread**, once, and the thread belongs to the page. A page may
  hold several conversations and only the page knows which should announce itself; a live region
  per bubble means every arrival interrupts the one before it.
- A delivery receipt is a glyph **and** a word. Two grey ticks against two blue ticks differ by
  colour alone, which is exactly what a state must not do. Each state draws a different shape —
  a clock, one tick, two ticks, two ticks in a ring — and each carries its own word.

## 3. Runs are worked out, not declared

Consecutive messages from one person share an avatar and a timestamp. The component reads its
own neighbours in the thread to decide that; the markup declares nothing.

Asking an author to keep `first`/`last` attributes in step as messages arrive is asking for them
to be wrong. The rule is in `sameRun`: same direction, same author, no system message, and no
more than five minutes apart.

**The gap matters.** Without it, a reply six hours later joins the run above and inherits a
timestamp from this morning — a message that reads as never having been sent.

## 4. A picture holds its own shape open, and this is subtler than it looks

A thread that reflows as each image lands throws the reader off the line they were on. The bubble
reserves the picture's shape from its `width` and `height` before anything arrives.

Two mistakes were made and measured on the way to getting this right, and both are recorded here
because both looked correct:

**The frame must stay in the layout.** Hiding the image and letting a skeleton size the bubble
collapsed it from `512×225` to `104×98` — the exact jump the reservation exists to prevent. The
image now stays in flow inside a frame and is only `visibility: hidden`.

**The frame needs a definite width.** `inline-size: min(100%, 20rem)` resolves a percentage
against a shrink-wrapping bubble by falling back to the content's intrinsic size — and an image
that has not arrived has an intrinsic size of zero. The frame collapsed, `aspect-ratio` had
nothing to multiply, and the reservation did nothing on exactly the load it exists for: a cold
one. It is `inline-size: 20rem; max-inline-size: 100%`.

The second one is invisible to any test that toggles a state on an image the browser already
has. It takes blocking the request to see it.

**A square placeholder is worse than none**: a square that grows into a 3:2 photograph does the
jump anyway, and now does it twice.

**The status text sits over the placeholder, not under it.** A line of text that appears and
disappears below the picture moves everything after it — the same fault at 25px.

**`alt` is the message.** A picture message with no alt is a message with no content at all for
some readers, and nothing says anything is missing.

## 5. A voice note without a transcript is a message some people cannot read

Audio is not an accessible format and a waveform is not a substitute for one. The transcript is
part of the contract here rather than an enhancement somebody remembers.

The waveform is a **fixed pattern** and carries `aria-hidden`. Drawing one to look like a real
analysis, for audio it never measured, would be a picture that lies.

Starting one note stops any other. Two voice notes talking over each other is nobody's idea of a
conversation.

The `<audio>` element stays in the markup as the engine and out of sight. The demo's file is
synthesized rather than recorded — a recording is somebody's voice, and this one ships in a
public repository.

## 6. A quotation is shortened, and can be followed

Truncated at a word with an ellipsis. Quoting a long message whole doubles the length of the
thread for anybody reading it aloud: the same paragraph twice, once as the message and once as
the quote.

Made into a **link** to the original, which then takes focus as well as scroll. A quotation that
only scrolls leaves anybody driving by keyboard exactly where they were, looking at a message
they cannot reach.

## 7. Colour, measured

Against this component's own **four** surfaces, on exact ratios. A thread is not one background:
there is the page, their bubble, your bubble, and the quoted panel nested inside either.

| | Floor | Light | Dark |
|---|---|---|---|
| Their words on their bubble | `4.5` | `17.7397` | `14.0007` |
| Your words on your bubble | `4.5` | `6.6282` | `5.1170` |
| A quotation, either side | `4.5` | `7.6517` | `6.0946` |
| Time and receipt on the page | `4.5` | `6.0850` | `8.2895` |
| A failure on the page | `4.5` | `6.0013` | `10.7057` |
| A link inside your bubble | `4.5` | `5.7723` | `4.5608` |
| Each bubble against the page | `1.2` | `1.2175` | `1.2067` |
| The two sides against each other | `1.5` | `6.6282` | `2.7361` |
| The play button on its bubble | `3.0` | `6.6282` | `8.0314` |

**The quotation gets its own surface** rather than being dimmer text on the accent. On a
saturated blue a "muted" ink misses `4.5` while looking perfectly fine — dark mode could not hold
both a 4.5 white and a 4.5 muted on any single blue that also read against the page.

**The bubble fill is held to `1.2`, not `3.0`.** A bubble is a grouping, not a control: you do
not operate it, and no part of the content depends on seeing its edge, because the speaker is a
word rather than a side of a screen.

## 8. Variants

| Variant | Teaches |
|---|---|
| Default | The speaker as a word, runs worked out from the neighbours, the thread's live region |
| Image | The reserved box, the failure, and why alt is the message |
| Reply | Truncating honestly, and a quotation you can follow back |
| Voice | The transcript, the honest waveform, one note at a time |
| Attachment | Naming a file before it is opened, and links on a saturated bubble |
| States | Receipts as glyph and word, a failure that asks something, a system notice |

## 9. Tokens

| Token | Role |
|---|---|
| `--chat-surface` | The page behind the thread |
| `--chat-their-bubble`, `--chat-their-ink`, `--chat-their-quote`, `--chat-their-quote-ink` | Their side |
| `--chat-my-bubble`, `--chat-my-ink`, `--chat-my-quote`, `--chat-my-quote-ink` | Yours |
| `--chat-meta`, `--chat-border`, `--chat-rule`, `--chat-rule-mine` | Furniture |
| `--chat-link`, `--chat-link-mine`, `--chat-control`, `--chat-failed`, `--chat-focus` | |
| `--chat-avatar`, `--chat-avatar-ink` | |
| `--chat-radius`, `--chat-radius-tight`, `--chat-max`, `--chat-motion` | |

## 10. Out of scope, deliberately

**The thread.** Day dividers, a scroll-to-bottom control, an unread marker and the live-region
policy are a component of their own, and one that has to own the scroll container. Here the
thread is ordinary page markup so the page keeps that decision.

**The composer.** It produces a value; this presents one.

## 11. Assets

Both pictures and the voice note live in `source/assets/` and are generated rather than
collected: two SVG scenes and an `8 kHz` WAV. Nothing in any variant reaches the network.

## 12. Distribution preview

`preview/thumbnail.svg` is a static `640×360` miniature of the Default variant: a run of two
messages from one speaker sharing an avatar, a reply on the other side with a read receipt, and
the timestamps where a run actually puts them. No animation, script, external asset, or embedded
raster image.

## 13. Acceptance criteria

- All six variants run independently in an iframe with **no external request** and no overflow,
  at 960 and 360.
- With scripting disabled every variant is a complete, readable conversation.
- Every message's spoken intro names its speaker, including run continuations.
- The thread carries exactly one live region; no message carries one.
- A run breaks on direction, author, a system notice, and more than five minutes.
- The reserved box holds its shape **before the picture has ever arrived**, not merely when a
  loading state is toggled on a cached one.
- A failed picture says so, keeps its box, and keeps its alt.
- Every voice note has a transcript behind a real disclosure; the waveform is `aria-hidden`;
  starting one stops the others.
- A quotation is shorter than what it quotes, ends in an ellipsis, and moves focus when followed.
- Every delivery state draws a different glyph and carries its own word.
- A failure keeps its receipt mid-run and offers a retry.
- No message content can push a bubble past the thread.
- Every contrast floor in section 7 is met in both themes.
