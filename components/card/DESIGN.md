# Card - Design Specification

## 1. Purpose

An article or product card, with a treatment when the pointer or focus arrives.

## 2. Nearly all of this is CSS

The hover treatments, the equal heights, the pinned footers, the clamped descriptions, the
picture shapes and the whole-card link are all stylesheet. The script does three things and
no more: reads the attributes into custom properties, follows the pointer for one treatment,
and refuses the press on a card that is unavailable.

That is worth saying out loud because the temptation in a component collection is to reach
for script by habit. This is the first component here whose script has to justify each of its
lines, and two of the things originally planned for it were measured out again.

## 3. The whole-card link

The real link is on the title, and a pseudo-element stretches its hit area over the card.
Measured, against the two obvious alternatives:

| Approach | Accessible name |
|---|---|
| Stretched link on the title | `"A quiet week in the harbour"` |
| The card wrapped in an `<a>` | `""` |

The second is the pattern most card systems reach for and it produces a link a screen reader
announces as nothing at all. The third alternative — a click handler on the card — is worse
still: no keyboard, no context menu, no opening in a new tab.

## 4. Two consequences, both measured

**Controls inside the card are swallowed.** Hit-testing over a button in an interactive card
returns the link. It looks pressable and it is not, and nothing reports it. The component
lifts every control except the title's own link, so an author cannot get this wrong.

`position` as well as `z-index`, and the reason is easy to miss: `z-index` applies to a flex
item whatever its position, so a control in a flex footer is lifted by the z-index alone and
the `position` looks redundant. A control that is not a flex item is not lifted, and that is
the one that would quietly stop working.

**The pointer never reaches the words.** Measured with a control group, which is what made
the measurement worth anything: a paragraph under the overlay selected `0` characters where
the same paragraph beside it selected 48. Two earlier attempts at this measurement were
thrown away — one used synthetic `MouseEvent`s, which never select text at all, and one had
no control and so proved only that the drag had not worked.

So `interactive` is **not** the default. A card without it has a link on the title and text
that can be selected like any other text.

## 5. A guard that was measured out again

The plan for this component included cancelling the click a drag produces, so that dragging
to select text across a card would not follow the link.

There is no such click. Measured: after a 180px drag over the card, **no `click` event fired
at all**; a plain press fired one. The browser does not produce a click when a mouse drag
travels any real distance.

So the guard was dead code — and worse than dead. The only presses it could ever have caught
are drags too short for the browser to notice, which is to say the small wobble of a hand
that meant to click. It would have broken clicking for the people least able to afford it.

The guard was removed, along with the `isDrag` rule written for it and that rule's tests.
Keeping tested dead code would have been the worse outcome of the two. A test remains that
records the finding, because the obvious next change to this component is to add the guard
back.

## 6. Every treatment answers focus

`:is(:hover, :focus-within)` throughout. A treatment that only appears under the pointer
tells a keyboard user nothing, and a touch screen has no hovering at all.

It matters most for `reveal`, whose buttons are in the tab order whether or not they are on
show: without the focus half, tabbing would move focus to a control nobody can see.

| Effect | What moves |
|---|---|
| `lift` | The card rises, gains a shadow, warms its border |
| `zoom` | The picture scales inside a frame that does not, so nothing reflows |
| `reveal` | A row of controls slides up over the picture |
| `border` | An accent ring and an outer glow, drawn on `::after` |
| `spotlight` | A radial gradient at the pointer, on `::before` |
| `none` | |

Both pseudo-elements carry `pointer-events: none`. They paint over the card, and the
whole-card link sits above them and has to keep receiving presses.

## 7. Only one treatment listens

`spotlight` is the only one that needs to know where the pointer is, so it is the only one
that gets a `pointermove` listener, added and removed as the attribute changes. A listener on
every card in a grid, firing on every pointer move, is a cost nobody asked for.

## 8. Visual tokens

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--card-surface` | `#ffffff` | `#171a20` | The card |
| `--card-raised` | `#f7f8fa` | `#1c2029` | The card while lifted |
| `--card-media` | `#eef1f5` | `#10131a` | Behind a picture, and the skeleton blocks |
| `--card-text` | `#15181d` | `#f4f6fa` | Titles and prices |
| `--card-muted` | `#4b525e` | `#a8afbc` | Descriptions and meta |
| `--card-border` | `#dfe3ea` | `#2e3440` | The edge and the footer rule |
| `--card-accent` | `#3857d6` | `#86a0ff` | The eyebrow, the ring, the primary action |
| `--card-focus` | `#3857d6` | `#86a0ff` | The focus ring |
| `--card-on-accent` | `#ffffff` | `#10131a` | Whatever is drawn on the accent |
| `--card-scrim` | `rgb(10 12 18 / 0.78)` | | Behind a badge and under a reveal row |
| `--card-radius`, `--card-ratio`, `--card-clamp`, `--card-x`, `--card-y` | | | |

Measured on the dark card surface: title `16.11:1`, price `16.11:1`, description `7.9:1`,
eyebrow `7.04:1`, badge on its scrim `19.55:1`, primary action `7.51:1`. On the light card
surface: title and price `17.78:1`, description `7.87:1`, eyebrow `5.99:1`, primary action
`5.99:1`, and the rating star `3.25:1` as a graphic. The rules ask for `4.5:1` on text and
`3:1` on a user interface boundary.

The accent is light in one theme and dark in the other, so anything drawn on top of it
travels with it through `--card-on-accent` rather than naming a colour of its own.

The scrim is the one colour that does not pair. It covers a picture rather than the card,
so it stays dark in both themes, and the badge and the reveal row keep their light-on-dark
treatment instead of taking `--card-text` — which in the light theme would put near-black
on near-black.

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

`--card-x` and `--card-y` are written by the element but declared in the stylesheet, so they
have values of their own rather than living only in a fallback.

## 9. Equal heights without measuring anything

Each card is `block-size: 100%` and the body is the one row that grows. In a grid of cards
that is enough: they fill their cells, the bodies take up the slack, and the footers line up.
Measured on a row of three with very different amounts of text: `340px` each, footers all at
the same offset.

## 10. Clamping says nothing when nothing was asked

`clampLines` returns `null` rather than a number for a missing or unusable value, and the
element leaves the attribute off entirely. "No limit" and "one line" are different answers,
and a fallback of one would quietly hide most of a card.

## 11. The picture beside the words

Applied only where there is a picture — `:has(.card__media)` — so a horizontal card without
one does not keep an empty column. The picture spans both grid rows, which is what pins the
footer to the bottom. Below `34rem` the columns become rows: a picture beside a paragraph on
a narrow screen leaves neither of them room.

## 12. States, none of them colour alone

- **Loading**: `aria-busy`, and `.card__skeleton` blocks that shimmer. Under
  `prefers-reduced-motion: reduce` the shimmer becomes a plain block — movement that starts on
  its own and never stops is exactly what that setting is for.
- **Unavailable**: dimmed, `aria-disabled`, the press refused, and a badge that says so in
  words. The link keeps its tab stop: a control nobody can reach is a control nobody can
  discover is unavailable, and a disabled element cannot hold focus at all. This is the
  seventh time that shape has come up in this collection.
- **Current**: an accent ring and `aria-current`. Which value is right depends on what the
  card stands for, so the author picks it.

## 13. The focus ring goes round the card

When the title's link has focus, the card is what is being activated, so the card is what
wears the ring and the link's own is removed. `:has()` does it.

## 14. Motion

Everything at `200ms`–`320ms`. `prefers-reduced-motion: reduce` removes every transition and
the shimmer.

## 15. Variants

| Variant | What it is for |
|---|---|
| Default | The article card, and the whole-card link beside a card without one |
| Effects | The five treatments, each answering focus |
| Product | Price, badge, rating, and controls above the overlay |
| Horizontal | The picture beside the words, and a card with none |
| Grid | Equal heights, pinned footers, clamped descriptions |
| States | Loading, unavailable, current |

## 16. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

The demo pictures are inline SVG artwork kept in `source/assets/`, a few hundred bytes each,
so the packaged download carries no binary payload.

## 17. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the cards still lay out, show their pictures, and link their
  titles.
- Hit-testing anywhere on an interactive card returns the title's link.
- A control inside an interactive card is hit-tested as itself and carries
  `position: relative`.
- Pressing a control does not follow the card; a plain press does.
- A paragraph under the overlay selects nothing where the same paragraph beside it selects
  text.
- A drag over the card produces no click at all.
- Every treatment changes under focus alone.
- The focus ring is on the card, not on the link.
- A row of cards is one height with its footers in line.
- A clamped description is cut; an unclamped one is not touched.
- A horizontal card puts the picture beside the words and keeps no column where there is no
  picture.
- Loading sets `aria-busy`; unavailable refuses the press, keeps its tab stop, and says so in
  words.
- The spotlight follows the pointer and no other card listens.
- Reduced motion removes the treatments and stills the shimmer.
