# Recreate Cursor Glow

Build a framework-free Web Component that lights a region around the pointer. Plain HTML, CSS
and JavaScript. No framework, no build step, no external request of any kind.

## The central instruction

Keep it the size of the problem. A light under the pointer is a position, and a position is
two numbers: one overlay carrying a radial gradient whose centre is `--cursor-glow-x` and
`--cursor-glow-y`, and a pointer handler that writes them. No canvas, no simulation, and no
animation frame while the pointer is still.

## Files

```text
cursor-glow-core.js   the rules, with no DOM in them
shared.js             the <ui-cursor-glow> element
shared.css            the region, its custom properties, the demo page
demo.js               demo wiring and the theme message
assets/*.svg          the picture the states demo shows
variants/{default,content,grid,tuning,states}/index.html
```

## Markup contract

The element wraps whatever should be lit and adds one overlay above it:

```html
<ui-cursor-glow>
  <div class="panel"><h2>Bring a light with you</h2></div>
</ui-cursor-glow>
```

No attributes: this is presentation, so the API is custom properties —
`--cursor-glow-ink`, `--cursor-glow-size`, `--cursor-glow-strength`, `--cursor-glow-fade`,
`--cursor-glow-blend`. Expose a read-only `active`, reflect `data-active` so CSS can answer
it, and fire no events: the region decides nothing.

## Write at most once a frame

A mouse reports over a hundred moves a second and every write to a custom property is a style
recalculation. Record the position on a move, ask for one frame, and let further moves inside
that frame overwrite the record. Take the position from the **last** event rather than
interpolating towards it, so the light is exactly under the pointer despite the throttle.

## Position never eases; brightness does

Keep the light exactly under the pointer and transition only its opacity. A light eased
towards the pointer is visibly behind the hand on a fast sweep and reads as page lag rather
than as a lamp being carried.

Leave the position where it was when the pointer goes. Fading out where it stood is what stops
a row of regions flickering as the pointer crosses the gaps between them.

## A light, not a lid

Put `aria-hidden` and `pointer-events: none` on the overlay, and say both out loud. An
absolutely positioned layer over content is the easiest way to take a page away from the
people using it: text must stay selectable, links followable, buttons pressable.

## Touch lights nothing

Answer `mouse` and `pen` pointers only. A touch screen has no hover, and a glow left where a
finger last touched is a smudge that stays until something else happens.

## The ink belongs to the surface

Do not sample what is underneath — that means reading pixels every frame, and it is still
wrong wherever the light crosses from a bright area to a dark one. Make the ink a custom
property instead, and say plainly in the design notes that on a pale surface a glow can only
be a tint: adding light to something near white does nothing. Offer
`--cursor-glow-blend: plus-lighter` for dark surfaces and show both.

Remember that `light-dark()` follows the document, not the surface: a dark panel inside a
light page needs its own ink named on it.

## Presentation

Resolve every colour through `light-dark()` and answer `{ type: 'ui-theme', theme }` from an
embedding page. `prefers-reduced-motion: reduce` keeps the light following the pointer — that
is a direct answer to something the reader is doing — and removes the fade.

## Verify before calling it done

- The light is centred on the pointer's position within the region, in the region's pixels.
- `data-active` goes on when the pointer enters and off when it leaves.
- A button under the light still takes its press, and text under it can still be selected.
- A touch pointer lights nothing.
- A still pointer costs no animation frames.
- In a grid of regions, only the one under the pointer is lit.
- Reduced motion keeps the light and removes the fade.
- No horizontal overflow at 320px, and no request leaves the page.
