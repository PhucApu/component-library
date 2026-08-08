# Chat Message

A framework-free Web Component for the bubbles in a conversation: words, pictures, quoted
replies, voice notes and attachments.

No React, no TypeScript, no Tailwind runtime, no build step, no network.

## Which side the bubble sits on is invisible

Every chat interface says **who is talking** with position and colour. A screen reader has
neither, so without help the whole conversation arrives as one block of text with no idea who
said what.

Every message here carries its speaker as a **word**, said once in front of the content — even
on the fourth bubble of a run, where nothing on screen names anybody. A run is a visual grouping,
and somebody listening has no run to see.

## The markup

```html
<ol class="chat-thread" role="log" aria-label="Conversation with Mai">
  <li>
    <ui-chat-message from="them" author="Mai" time="2026-08-07T09:12">
      <p>Are we still on for three?</p>
    </ui-chat-message>
  </li>
  <li>
    <ui-chat-message from="me" time="2026-08-07T09:15" status="read">
      <p>Three works.</p>
    </ui-chat-message>
  </li>
</ol>
```

**The thread belongs to the page.** `role="log"` sits once on the list, not on each message: a
page may hold several conversations and only the page knows which should announce itself. A live
region per bubble means every arrival interrupts the one before it.

With scripting off it is an ordered list of messages, complete and readable.

## Runs work themselves out

Consecutive messages from one person share an avatar and a timestamp. The component reads its
neighbours to decide; the markup declares nothing.

Same direction, same author, no system notice, and **no more than five minutes apart**. Without
that gap a reply six hours later joins the run above and inherits a timestamp from this morning.

## Pictures

```html
<ui-chat-message from="them" author="Mai" time="2026-08-07T08:02">
  <img src="market.jpg" width="1200" height="800"
       alt="A market street just after sunrise, with striped awnings over crates of oranges" />
</ui-chat-message>
```

`width` and `height` are not optional. They reserve the picture's own shape so the thread never
reflows when it lands — a square placeholder that then grows into a 3:2 photograph does the jump
anyway, twice.

`alt` is not optional either. A picture message without it is a message with no content at all
for some readers, and nothing says anything is missing.

## Voice notes

```html
<ui-chat-message from="them" author="Mai" time="2026-08-07T11:20">
  <audio src="note.wav"></audio>
  <p data-transcript>Quick one about tomorrow — the room is booked from ten…</p>
</ui-chat-message>
```

**A voice note with no transcript is a message some people simply cannot read.** Audio is not an
accessible format and a waveform is not a substitute for one.

The waveform is a fixed pattern and carries `aria-hidden` — one drawn to look like a real
analysis, for audio it never measured, would be a picture that lies. Starting one note stops the
others.

## Replies

```html
<ui-chat-message from="me" time="2026-08-07T10:31" reply-to="msg-budget" reply-author="Linh">
  <blockquote data-quote>I've put the revised budget in the shared folder…</blockquote>
  <p>Found it.</p>
</ui-chat-message>
```

The quotation is truncated at a word — quoting a long message whole doubles the thread for
anybody reading it aloud — and turned into a link that moves **focus** as well as scroll. A
quotation that only scrolls leaves a keyboard user where they were.

## Attachments

```html
<ui-chat-message from="them" author="Linh" time="2026-08-07T14:02">
  <a data-file data-name="Quarterly review.pdf" data-size="2411724" href="…" download>…</a>
</ui-chat-message>
```

The name and size are visible and in the link's accessible name. A paperclip with no filename
asks somebody to download a thing to find out what it is.

## Attributes, properties, events

| Attribute | Values | Effect |
|---|---|---|
| `from` | `them` (default) `me` | Which side, and which word the speaker gets |
| `author` | string | The name spoken and shown at the top of a run |
| `time` | `YYYY-MM-DDTHH:mm` | Civil time, never moved through a timezone |
| `type` | `text` `image` `voice` `file` `link` `system` `deleted` | Inferred from the content when absent |
| `status` | `sending` `sent` `delivered` `read` `failed` | Absent means no receipt at all |
| `loading` | present | Hold the picture's box before it arrives |
| `edited` | present | |
| `reply-to` · `reply-author` | id · string | Where the quotation points |
| `locale` · `hour12` | | How the time is printed and spoken |

| Member | Notes |
|---|---|
| `speaker` | The word a screen reader is given |
| `direction` · `type` · `status` | Resolved, not raw |
| `refresh()` | Re-read after the page rewrites the message |
| `labels` | Overrides every generated string |

| Event | Detail |
|---|---|
| `chat-retry` | `{ id, direction }` — the component asks; the page answers |

## Receipts are never a colour

Two grey ticks against two blue ticks differ by colour alone. Each state here draws a different
shape — a clock, one tick, two ticks, two ticks in a ring — and carries its own word.

The receipt shows on the last message of a run, where the timestamp is. A **failure** always
shows, because it is the one state that asks something of the reader rather than telling them
something.

## Colour, measured

Against four surfaces, on exact ratios:

| | Floor | Light | Dark |
|---|---|---|---|
| Their words on their bubble | `4.5` | `17.7397` | `14.0007` |
| Your words on your bubble | `4.5` | `6.6282` | `5.1170` |
| A quotation, either side | `4.5` | `7.6517` | `6.0946` |
| A link inside your bubble | `4.5` | `5.7723` | `4.5608` |
| Each bubble against the page | `1.2` | `1.2175` | `1.2067` |

A quotation gets its own surface rather than being dimmer text on the accent: on a saturated
blue, "muted" misses `4.5` while looking perfectly fine.

## Reduced motion

`prefers-reduced-motion: reduce` stops the loading skeleton shimmering — it still holds the
space, which was always its real job — and follows a quotation without a smooth scroll.

## Not included

**The thread itself.** Day dividers, scroll-to-bottom, an unread marker and the live-region
policy are a component of their own, and one that has to own the scroll container.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `light-dark()`, `color-mix()`,
`aspect-ratio`, and CSS grid.

## Files

| Path | Contents |
|---|---|
| `chat-message.html` | Runnable example |
| `chat-message.css` | Every style, including the measured palette |
| `chat-message.js` | The rules, the custom element, and the demo bootstrap |
