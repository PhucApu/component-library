# Switch - Design Specification

## 1. Purpose

Turn one setting on or off. The distinction from a checkbox is not how it looks: a
checkbox is a selection that is applied when the form is submitted, while a switch
**takes effect immediately**. Everything below follows from that.

If the change only lands when the person presses Save, the control is a checkbox.

## 2. Enhance, do not replace

The control is a native `input type="checkbox"`. It already supplies the checked state,
the Space key, the label association, the form value, and participation in a disabled
`fieldset`.

What is unusual here is how little script is left. The track and the thumb are drawn in
CSS on the checkbox itself with `appearance: none` and a `::before` thumb, so the switch
**renders and toggles with no JavaScript at all**. Script adds three things CSS cannot:
the `switch` role, the description wiring, and the pending state.

This is the same decision as Radio Group and Text Field, and the opposite of Temporal
Picker and Autocomplete, which build their controls because HTML offers no equivalent.

## 3. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog. Each one
is a `light-dark()` pair, so which half a browser uses follows the page's `color-scheme`
rather than a class the author has to remember to set.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--switch-track` | `#cbd5e1` | `#2b303a` | Track when off |
| `--switch-accent` | `#4f46e5` | `#4968e8` | Track when on |
| `--switch-thumb` | `#ffffff` | `#f4f6fa` | Thumb fill |
| `--switch-outline` | `#4b5563` | `#8b94a6` | Track edge and thumb edge |
| `--switch-focus` | `#6366f1` | `#86a0ff` | Focus ring |
| `--switch-text` | `#111827` | `#f4f6fa` | Label |
| `--switch-muted` | `#5f6878` | `#a8afbc` | Supporting text |
| `--switch-danger` | `#b42318` | `#ff8e87` | Failure text |

Measured for the label: `16.11:1` on the dark demo card, `17.78:1` on the light one.
Supporting text holds `5.62:1` light and `7.9:1` dark. The rules ask for `4.5:1`.

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

## 4. Anatomy

1. The checkbox, drawn as a track with a thumb.
2. A `label`, associated by `for` and `id`.
3. Optional supporting text, referenced with `aria-describedby`.
4. A status region the component adds, used only while a commit is running.
5. A spinner the component adds and removes with the pending state.

## 5. No hand-written `aria-checked`

A native checkbox carrying `role="switch"` exposes its own checked state; the browser's
accessibility tree reports `checked: true` or `checked: false` from the DOM property. A
hand-written `aria-checked` would be a second copy of that state with nothing keeping it
honest.

Measured in Chromium: with the attribute absent, the four switches on the Default variant
report `Wi-Fi false`, `Bluetooth true`, `Personal hotspot false`, `Nearby sharing true`,
and `Wi-Fi` flips to `true` on click.

## 6. The label does not change with the state

"Wi-Fi" stays "Wi-Fi". The state belongs to the control, not to the words beside it. A
control whose label alternates between "Turn on Wi-Fi" and "Turn off Wi-Fi" is a button,
and should be built as one.

## 7. Space toggles, Enter does not

Native checkbox behaviour, kept as it is. Inside a form Enter submits, and taking that key
for the switch would break the form to duplicate a key the switch already has.

## 8. Pending, and the failure that follows it

A switch that takes effect immediately usually has to tell a server. Consumers assign an
async handler:

```js
element.commit = async (checked) => { await api.set(checked); };
```

While it runs the switch is locked, and when it rejects the switch **returns to where it
was**, because showing a state the server never accepted is a lie.

Two decisions inside that:

- The lock is applied by cancelling the click, **not** by setting `disabled`. A disabled
  element loses focus, which would drop a keyboard user back at the top of the document in
  the middle of their task. `aria-disabled="true"` reports the state without moving
  anything. Measured: focus stays on the switch through the whole request and its failure.
- Putting the switch back is a plain assignment to `checked`. Assignment does not fire
  `change`, so the restore cannot re-enter the commit that caused it.

The lock covers every way of pressing: the track, the label, and the Space key. Measured
against a request that never settles, all three leave the change count at one.

## 9. No duplicate change event

The native `change` already bubbles past the host. A `switch-change` event would give
consumers two ways to hear the same toggle and an easy way to handle it twice.

Two events are added, both carrying information the platform does not provide:
`switch-pending` and `switch-error`.

## 10. State without colour, and the small target

The thumb's **position** is the primary signal, so the state survives for anyone who
cannot separate the two track colours.

Measured on the demo surface, all four boundaries clear the 3:1 required of a user
interface component: off-track edge 5.71, thumb edge against the off track 4.34, on-track
fill 3.68, thumb against the on track 4.38.

The compact track is drawn 20px tall, under the 24px WCAG 2.2 asks for. An invisible
`::after` carries the hit area to 24px without changing what is painted; measured, a point
11px above and 11px below the centre both land on the control.

## 11. Read-only does not exist here

The browser ignores `readonly` on a checkbox, exactly as it does on a radio. A switch that
must not be changed is `disabled`; a value that is only ever read should not be drawn as a
switch at all.

`fieldset[disabled]` is the trap that comes with this. An input inside one reports
`disabled === false` from its own property while the browser still refuses to operate it,
so the host reads `:disabled` instead. Measured: all four rows on the Restricted variant
are marked, though only two carry the attribute.

## 12. Responsive behavior and motion

- The row fills its container; the switch holds its size and the text takes the rest.
- Supporting text moves the switch to the top of the row rather than the middle.
- Transitions cover the track colour and the thumb position at `160ms`.
- `prefers-reduced-motion: reduce` removes them and stops the spinner. The dimmed track
  and the status message still report the busy state, so nothing rests on the animation.

## 13. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Group variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 14. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the control is still drawn as a switch and still toggles.
- `aria-checked` is never written, and the accessibility tree still reports on and off.
- A pending commit cannot be toggled by track, label, or keyboard, and never moves focus.
- A rejected commit returns the switch to its previous state and reports the failure.
- A disabled switch is left out of the submission however it was disabled.
