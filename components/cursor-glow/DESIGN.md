# Cursor Glow - Design Specification

## 1. Purpose

A region that answers the pointer with light. The deliverable is the motion of the light
across a surface — remove it and this is a panel — which is why it is an animation rather
than a container.

## 2. It overlaps with the card, and that is worth saying

The `card` component already has a spotlight treatment that does something close to this.
The difference is where it lives: that one is a variant of a card and cannot be lifted out of
it, and this one goes round anything — a paragraph, a picture, a grid tile, a hero.

Two components sharing an effect is a cost. It is worth it here because the alternative is a
page that wants a lit banner having to make it a card first, and because the two answer to
different owners: the card's spotlight is part of the card's design, and this one is a
standalone effect a page composes with.

## 3. Two numbers and a gradient

The whole effect is one overlay carrying a radial gradient whose centre is
`--cursor-glow-x` and `--cursor-glow-y`. Moving the pointer changes those two numbers.

There is no canvas, no simulation, and no animation frame while the pointer is still. That is
not an optimisation to be proud of so much as the honest size of the problem: a light under
the pointer is a position, and a position is two numbers.

## 4. Written at most once a frame

A mouse can report over a hundred moves a second, and each write to a custom property is a
style recalculation. So the writes are collected: a move records the position and asks for a
frame, and further moves inside the same frame overwrite the record rather than adding work.

The light does not lag because of it. The position is taken from the **last** event rather
than interpolated towards it, so what lands in the frame is where the pointer actually is.

## 5. Position never eases; brightness does

The light is exactly under the pointer at all times. What moves is how much of it there is:
it comes up as the pointer arrives and goes out over the same time when it leaves.

A light that eased towards the pointer was tried in the shape of the alternative and rejected:
on a fast sweep it is visibly behind the hand, and a light that trails the pointer reads as a
lag in the page rather than as a lamp being carried.

Leaving does not snap it off at the border. The position is left where it was, so it fades out
where it stood — which is what stops a row of regions flickering as the pointer crosses the
gaps between them.

## 6. A light, not a lid

The overlay carries `aria-hidden` and `pointer-events: none`. Both have to be said out loud:
an absolutely positioned layer over content is the easiest way in a component library to take
a page away from the people using it. Text under it stays selectable, links stay followable,
buttons stay pressable, and a screen reader meets nothing new.

## 7. Touch lights nothing

A touch screen has no hover: a finger is either pressing or absent. A glow left sitting where
a finger last touched is not a light following anybody — it is a smudge, and it stays until
something else happens. Only `mouse` and `pen` pointers light the region.

## 8. What the ink can and cannot do

The light is laid over whatever is underneath and never reads it. Reading it would mean
sampling pixels every frame, which is expensive and still wrong wherever the light crosses
from a bright area to a dark one.

So the ink is the page's decision, and there is a limit worth stating plainly: on a pale
surface, adding light to something already near white does nothing. The pale half of the
default pair is therefore a tint — a wash of colour that reads as attention rather than as
illumination. A page that wants real light on a dark surface sets
`--cursor-glow-blend: plus-lighter`, and the `tuning` variant shows the two side by side.

`light-dark()` follows the document, not the surface. A dark panel inside a light page is
given the light theme's ink unless it names its own, which is why every dark demo here does.

## 9. Visual tokens

| Token | Role |
|---|---|
| `--cursor-glow-ink` | Colour and transparency of the light |
| `--cursor-glow-size` | Its width |
| `--cursor-glow-strength` | One multiplier over the whole region |
| `--cursor-glow-fade` | Coming up and going out |
| `--cursor-glow-blend` | Laid over, or added to |

### Choosing a theme

Every pair resolves through `light-dark()`, so the component follows the operating system
without a script. An embedding page posts `{ type: 'ui-theme', theme }` and the demo narrows
`color-scheme` to that keyword. The message carries no token and no stylesheet, so answering
it adds no dependency on the host.

## 10. Motion

260ms up and the same down, on the standard ease. `prefers-reduced-motion: reduce` removes
that transition: the light is simply on where the pointer is and off when it leaves. Nothing
else here moves on its own, so nothing else has to be taken away.

## 11. Responsive behaviour

The region is measured at the moment the pointer moves rather than remembered, so a page that
scrolls, a box that scrolls inside it, and a resize all leave the light exactly where the
pointer is without anything having to be recalculated on a schedule.

## 12. Variants

| Variant | Shows |
|---|---|
| `default` | A dark panel, a warm ink, and light that fades out where it left |
| `content` | Words, a link and a button all working under the light |
| `grid` | Four regions, each lighting only itself |
| `tuning` | Size, strength, ink, fade, and blending |
| `states` | Over a picture, inside a scroller, touch and reduced motion |

## 13. Distribution preview

The packaged demo is the `default` variant: it is the one that shows the light arriving,
following, and going out, with the ink named for the surface rather than the page.

## 14. Acceptance criteria

- The light is centred on the pointer's position within the region, in the region's pixels.
- `data-active` is set while the pointer is inside and cleared when it leaves.
- The overlay is `aria-hidden` and takes no pointer events; a button under it still works.
- A touch pointer lights nothing.
- A still pointer costs no animation frames.
- In a grid, only the region under the pointer is lit.
- Reduced motion keeps the light and removes the fade.
- No horizontal page overflow from 320px, and no external requests.
