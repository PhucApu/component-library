# Recreate Card

You are a Senior Frontend Engineer. Build a Web Component named `<ui-card>` using plain HTML,
CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

## The central instruction

**Nearly all of this is CSS.** The hover treatments, the equal heights, the pinned footers,
the clamped descriptions and the whole-card link are all stylesheet. Make the script justify
each of its lines; a card is one of the few components where reaching for script by habit is
the whole mistake.

```html
<ui-card interactive effect="lift">
  <div class="card__media"><img src="…" alt="What the picture shows" /></div>
  <div class="card__body">
    <p class="card__eyebrow">Category</p>
    <h3 class="card__title"><a href="/story">The title of the thing</a></h3>
    <p class="card__text">A sentence or two about it.</p>
  </div>
  <div class="card__footer">
    <span class="card__meta">14 March</span>
    <button type="button" class="card__action">Save</button>
  </div>
</ui-card>
```

Every part is optional except a title.

## Variants

Build six, each teaching one thing.

- **Default**: an article card, and the whole-card link beside a card without one.
- **Effects**: the five treatments, each answering focus.
- **Product**: price, badge, rating, and controls above the whole-card link.
- **Horizontal**: the picture beside the words, and a card with none.
- **Grid**: equal heights, pinned footers, clamped descriptions.
- **States**: loading, unavailable, current.

## The whole-card link, and the two things that follow

Put the real link on the title and stretch its hit area with a pseudo-element. Measure the
alternatives before you argue with this:

| Approach | Accessible name |
|---|---|
| Stretched link on the title | the title |
| The card wrapped in an `<a>` | **`""`** |

The second is what most card systems reach for and it produces a link a screen reader
announces as nothing. A click handler on the card is worse still: no keyboard, no context
menu, no opening in a new tab.

**Controls inside the card are swallowed by the overlay.** A button is hit-tested as the
link: it looks pressable and is not, and nothing reports it. Lift every control except the
title's own link, **from the stylesheet**, so an author cannot get it wrong.

Set `position` as well as `z-index`. `z-index` applies to a flex item whatever its position,
so a control in a flex footer is lifted by the z-index alone and the `position` looks
redundant — until somebody adds a control that is not a flex item, and it quietly stops
working.

**The pointer never reaches the words.** Measure it *with a control group*: a paragraph under
the overlay against the same paragraph beside it. Without the control, a drag that selects
nothing proves only that your drag did not work. Because of this, make the whole-card link
**opt-in** rather than the default.

## Do not add a drag guard

It is the obvious next thought, and it is wrong. **Measure it**: a mouse drag of any real
length over a link fires **no click at all**. There is nothing to cancel.

A guard could therefore only ever catch a drag too short for the browser to notice — the
small wobble of a hand that meant to click. Cancelling that breaks clicking for the people
least able to afford it. Write a test that records this, because the guard is the first thing
somebody will try to add back.

## Every treatment answers focus

`:is(:hover, :focus-within)` throughout. A treatment that only appears under the pointer
tells a keyboard user nothing, and a touch screen has no hovering at all.

It matters most for a treatment that reveals controls: they are in the tab order whether or
not they are on show, so without the focus half, tabbing moves focus to something nobody can
see.

Give any pseudo-element that paints over the card `pointer-events: none` — the whole-card
link sits above it and has to keep receiving presses.

**Only the pointer-following treatment gets a `pointermove` listener**, added and removed with
the attribute. A listener on every card in a grid, firing on every pointer move, is a cost
nobody asked for.

## Equal heights without measuring anything

`block-size: 100%` on the card and one flexible row in the middle. In a grid the cards fill
their cells, the bodies take the slack, and the footers line up. Nothing is measured and
nothing is recomputed on resize.

Apply the horizontal layout only where there is a picture, or a card without one keeps an
empty column beside it. Span the picture across both rows: that is what pins the footer.

## Clamping says nothing when nothing was asked

Return `null` for a missing or unusable line limit and leave the attribute off. "No limit" and
"one line" are different answers, and a fallback of one quietly hides most of a card.

## States, none of them colour alone

- **Loading**: `aria-busy`, plus skeleton blocks that shimmer. Under
  `prefers-reduced-motion: reduce` the shimmer becomes a plain block.
- **Unavailable**: dimmed, `aria-disabled`, the press refused, **and a badge that says so in
  words**. Keep the link's tab stop: a control nobody can reach is a control nobody can
  discover is unavailable, and a disabled element cannot hold focus at all.
- **Current**: an accent ring and `aria-current`, whose value the author picks.

## Presentation

- Put the focus ring round the **card** when its link has focus, and take it off the link.
  The card is what is being activated.
- A picture keeps its shape with `aspect-ratio` and `object-fit: cover`, so a zoom on hover
  reflows nothing.
- Fall back rather than pass an invalid `aspect-ratio` through: the browser ignores it, and a
  card whose picture is suddenly its natural size breaks every row it sits in.
- `prefers-reduced-motion: reduce` removes every transition and the shimmer.
- Define every CSS custom property the component reads inside the component itself —
  including the ones the script writes.

## Verify before calling it done

Keep the rules that decide things — the treatment, the orientation, the line limit, the
picture shape, the pointer position, the state attributes — reachable without a browser.

Check these explicitly, because each is a place this component quietly goes wrong:

- Hit-testing anywhere on an interactive card returns the title's link.
- A control inside one is hit-tested as itself. Assert its `position`, not only that the hit
  succeeded: in a flex footer the z-index alone makes it pass.
- Pressing a control does not follow the card; a plain press does. Watch this on the **card**
  in the bubble phase — a demo page usually cancels every link on `document`, and a listener
  up there reads that instead and reports "not followed" whatever the component did.
- A paragraph under the overlay selects nothing where the control paragraph selects text.
- A drag over the card produces no click.
- Each treatment changes under focus alone — and probe them **one at a time**, or only the
  last card focused is measuring anything.
- Clamp the card that actually has enough words to be cut.
- Reduced motion removes the treatments and stills the shimmer.
