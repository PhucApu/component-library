# Switch

A framework-free Web Component that draws a native checkbox as an on/off switch in CSS
alone, and adds a pending state for changes that have to travel to a server.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## Switch or checkbox?

| | Takes effect |
|---|---|
| Checkbox | When the form is submitted |
| Switch | Immediately |

If the setting only lands when the person presses Save, use a checkbox. A switch beside a
Save button is telling two different stories about the same change.

## Markup contract

```html
<ui-switch>
  <input type="checkbox" id="wifi" name="wifi" class="switch__control" />
  <label for="wifi">Wi-Fi</label>
</ui-switch>
```

- Write `type`, `id`, `name`, and the label's `for` in the markup. The switch renders and
  toggles before any script runs, and `name` is what carries the value into the form.
- The label names the setting and **does not change with the state**. "Wi-Fi" stays
  "Wi-Fi". A control whose label alternates between "Turn on" and "Turn off" is a button.

With supporting text:

```html
<ui-switch>
  <input type="checkbox" id="analytics" name="analytics" class="switch__control" />
  <label for="analytics">Share usage analytics</label>
  <p class="switch__description">Sends anonymous counts of which screens are opened.</p>
</ui-switch>
```

The description is referenced with `aria-describedby`, so it is read after the name rather
than folded into it.

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `size` | `md`, `sm` | `md` | Track size |
| `placement` | `end`, `start` | `end` | Whether the label follows the switch or leads the row |
| `pending` | present or absent | absent | Locks the switch and shows the busy state |

`pending` is set and cleared by the component around a `commit`. Set it yourself only when
you are running the request without `commit`.

## Properties, methods, events

| Member | Type | Notes |
|---|---|---|
| `checked` | boolean | Reads and writes the control |
| `pending` | boolean | Mirrors the attribute |
| `commit` | function or null | Async handler, see below |
| `control` | element | The checkbox |
| `labels` | object | Overrides the status wording |

| Event | Detail |
|---|---|
| `switch-pending` | `{ pending, checked }` |
| `switch-error` | `{ reason, checked, requested }` |

There is deliberately **no `switch-change` event**. The native `change` already bubbles
past the host; a second one would give you two ways to hear the same toggle.

## Saving to a server

```js
document.querySelector('#wifi-switch').commit = async (checked) => {
  const response = await fetch('/api/wifi', {
    method: 'POST',
    body: JSON.stringify({ enabled: checked }),
  });

  if (!response.ok) {
    throw new Error('The server refused the change.');
  }
};
```

While the promise is open the switch is locked against the track, the label, and the
keyboard, and a status region announces the direction of travel. If it rejects, the switch
**returns to its previous state** and `switch-error` fires with your reason.

The lock is not `disabled`, because a disabled element loses focus and would drop a
keyboard user out of the row mid-task. It is `aria-disabled` plus a cancelled click, so
focus stays where the person left it.

## Status wording

```js
element.labels = {
  turningOn: 'Enabling {label}',
  turningOff: 'Disabling {label}',
  failedOn: '{label} could not be enabled',
  failedOff: '{label} could not be disabled',
};
```

`{label}` is filled from the label text. An unlabelled switch closes the gap rather than
announcing a double space.

## Keyboard

| Key | Action |
|---|---|
| `Tab` | Moves to and from the switch |
| `Space` | Toggles |

`Enter` is deliberately left alone. Inside a form it submits, and taking that key would
break the form to duplicate one the switch already has.

## Unavailable switches

Use `disabled`, on the input or on a surrounding `fieldset`. **`readonly` does nothing on
a checkbox** — the browser ignores it, exactly as it does on a radio. A value that is only
ever read should not be drawn as a switch at all.

Either way the switch is left out of the submitted data.

## Without JavaScript

The track and the thumb are CSS on the checkbox itself, so a page with no script running
still shows a switch and still toggles it. The one thing script adds is `role="switch"`,
so without it the control is announced as a checkbox rather than as on/off. Everything
else — the label, the value, the form — comes from the markup.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `:has()`,
`color-mix()`, and `appearance: none` on a checkbox.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

The switches themselves would still work from a file, without the role and the pending
state.

## Files

| Path | Contents |
|---|---|
| `switch.html` | Runnable example |
| `switch.css` | Every style |
| `switch.js` | Rules, the custom element, and the demo bootstrap |
