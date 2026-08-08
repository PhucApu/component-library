# Light Pull

A cord that hangs, that you can take hold of anywhere along its length, and that works a
switch when you pull it far enough. Every joint carries its own momentum, so it curves as it
is pulled, follows a hand with a lag, and swings itself out after it is let go.

## Markup contract

The element draws everything it needs:

```html
<link rel="stylesheet" href="light-pull.css" />
<script type="module" src="light-pull.js"></script>

<div class="room">
  <ui-light-pull label="Room light"></ui-light-pull>
</div>
```

Give it a box to hang in — position it and give it a height. The cord hangs from the top
centre of that box.

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `on` | absent | Whether the switch is on. Reflected, so it always says where it stands. |
| `label` | `Light` | Accessible name for the switch. |
| `length` | `180` | The cord in pixels. Clamped to `60`–`520`. |

## Properties, methods, events

- `on` — get or set the switch.
- `length` — the cord length in use.
- `swinging` — whether the cord is still moving.
- `toggle()` — work the switch without moving the cord.
- `pull()` — tug the cord and work the switch, which is what a press does.
- `light-pull-change` — fired when the switch changes. `detail` carries `{ on }`.

## What it switches

Nothing. The component holds a state and says when it changes; the page decides what that
means:

```js
const pull = document.querySelector('ui-light-pull');
const room = document.querySelector('.room');

pull.addEventListener('light-pull-change', () => {
  room.toggleAttribute('data-lit', pull.on);
});
```

That is why the same cord can work a lamp, a colour scheme, a preference, or nothing at all.

## Pulling it

Take hold anywhere along the cord: the part above your hand goes taut, the part below hangs
free. The cord gives its own length plus the travel of the switch it is fastened to, and no
more — the hand can go further, the cord stops.

Pull past the catch and let go and the switch works, the way a real cord switch does. A short
tug does nothing but set it swinging. A press without a drag is a tug at the handle.

## Keyboard

The handle is a real `role="switch"` with `aria-checked`. Tab to it and press Space or Enter:
the cord is tugged and the switch works. The cord itself is a picture — it carries
`aria-hidden`, because the button already says everything there is to say.

## Reduced motion

Under `prefers-reduced-motion: reduce` the cord does not swing. The switch works and the cord
is where it hangs.

## Cost

The simulation runs only while the cord is moving, on a fixed step so it cannot judder with
the frame rate, and stops the frame after the cord has settled. A cord hanging still asks for
no animation frames at all.

## Light and dark

Every colour resolves through `light-dark()`, so the component follows the operating system
on its own. An embedding page that wants to pin one theme posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }` to the frame, which narrows `color-scheme`.

## Custom properties

| Property | Does |
|---|---|
| `--light-pull-cord` / `--light-pull-width` | The colour and thickness of the cord |
| `--light-pull-grip` / `--light-pull-grip-edge` | The handle |
| `--light-pull-grip-size` / `--light-pull-grip-length` | How big the handle is |
| `--light-pull-focus` / `--light-pull-shadow` | Focus ring and the shadow under the grip |

## Browser support

Needs custom elements, Pointer Events, `ResizeObserver`, the CSS `translate`/`rotate`
properties and `light-dark()`: Chrome and Edge 123+, Safari 17.5+, Firefox 128+.

## Running the files

Open `light-pull.html` from a local server so the module loads over HTTP.

## Files

| File | Holds |
|---|---|
| `light-pull.html` | The demo page |
| `light-pull.css` | The cord, the handle, and the demo page chrome |
| `light-pull.js` | The element, the simulation, and the demo wiring |
