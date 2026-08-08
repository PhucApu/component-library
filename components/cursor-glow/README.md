# Cursor Glow

A region that lights up around the pointer. The light sits exactly under it, comes up as the
pointer arrives, and goes out where the pointer left.

## Markup contract

Wrap whatever should be lit:

```html
<link rel="stylesheet" href="cursor-glow.css" />
<script type="module" src="cursor-glow.js"></script>

<ui-cursor-glow>
  <div class="panel">
    <h2>Bring a light with you</h2>
    <p>Ordinary content, lit from above.</p>
  </div>
</ui-cursor-glow>
```

The element adds one overlay above the content and nothing else. It gives itself
`position: relative`, and the overlay takes the element's own `border-radius`, so a rounded
region keeps its corners.

## Custom properties

There are no attributes: this is presentation, and presentation belongs in CSS.

| Property | Default | Does |
|---|---|---|
| `--cursor-glow-ink` | a `light-dark()` pair | The colour and transparency of the light |
| `--cursor-glow-size` | `420px` | How wide the light is |
| `--cursor-glow-strength` | `1` | A multiplier over the whole thing |
| `--cursor-glow-fade` | `260ms` | How long it takes to come up and to go out |
| `--cursor-glow-blend` | `normal` | `plus-lighter` adds light instead of laying it over |

`--cursor-glow-x` and `--cursor-glow-y` are written by the element. Read them if you want to
light something else from the same pointer; do not set them.

## Choosing the ink

The ink belongs to the surface, not to the page. `light-dark()` follows the document's colour
scheme, so a dark panel inside a light page would otherwise be given the light theme's ink —
name a colour on that panel instead.

On a dark surface, adding light is what makes a glow look like light:
`--cursor-glow-blend: plus-lighter`. On a pale surface there is nothing to add light to, which
is why the default lays a tint over instead.

## Properties

- `active` — whether the pointer is inside the region and lighting it.
- The element also reflects `data-active`, so CSS can answer it: lift the card while it is
  lit, or brighten its border.

There is no event. The region decides nothing, so there is nothing to announce.

## What it costs

One gradient and two numbers. Moving the pointer writes those two numbers at most once a
frame however fast the mouse reports, and a region with the pointer elsewhere asks for no
animation frames at all.

## Pointer, touch, keyboard

A mouse or a pen lights the region. **A finger does not**: a touch screen has no hover, and a
glow left where a finger last touched is a smudge rather than a light following anyone.

There is nothing to operate, so there is no keyboard behaviour and nothing is focusable. The
overlay carries `aria-hidden` and takes no pointer events: text under it stays selectable,
links stay followable, buttons stay pressable.

## Reduced motion

Under `prefers-reduced-motion: reduce` the light still follows the pointer — that is a direct
answer to something the reader is doing — but the fading in and out goes.

## Light and dark

Every colour resolves through `light-dark()`, so the component follows the operating system
on its own. An embedding page that wants to pin one theme posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }` to the frame, which narrows `color-scheme`.

## Browser support

Needs custom elements, Pointer Events, `light-dark()` and CSS custom properties in gradients:
Chrome and Edge 123+, Safari 17.5+, Firefox 128+. `plus-lighter` is optional and degrades to
a normal overlay where it is missing.

## Running the files

Open `cursor-glow.html` from a local server so the module and the picture load over HTTP.

## Files

| File | Holds |
|---|---|
| `cursor-glow.html` | The demo page |
| `cursor-glow.css` | The region, its custom properties, and the demo page chrome |
| `cursor-glow.js` | The element, its rules, and the demo wiring |
| `assets/` | The picture the states demo shows |
