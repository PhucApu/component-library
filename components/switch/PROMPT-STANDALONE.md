# Recreate Switch as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-switch>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project.
It is self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

A switch is a native `input type="checkbox"`, restyled. Draw the track and the thumb in
CSS **on the checkbox itself** with `appearance: none` and a `::before` thumb, so the
control renders and toggles with no script running. Script adds only what CSS cannot: the
`switch` role, the description wiring, and the pending state.

Keep in mind what separates a switch from a checkbox: a checkbox is a selection applied
when the form is submitted, a switch takes effect immediately. Every decision below
follows from that.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
switch.html
switch.css
switch.js
README.md
```

- `switch.js` is one ES module holding the DOM-free rules, the custom element, and the
  demo bootstrap. It defines the element only when it is not already registered.
- `switch.css` holds every style, driven by component-owned CSS custom properties.
- `switch.html` is a runnable example showing a plain switch, a row with supporting text,
  a group inside a form, a switch saved asynchronously, and an unavailable one, reporting
  state into an `<output>`.
- `README.md` documents the markup contract, the attribute table, the commit handler, and
  browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the
page must be served over HTTP or HTTPS, while noting the switches themselves would still
toggle.

## Markup contract

```html
<ui-switch>
  <input type="checkbox" id="wifi" name="wifi" class="switch__control" />
  <label for="wifi">Wi-Fi</label>
  <p class="switch__description">Optional supporting text.</p>
</ui-switch>
```

- `type`, `id`, `name`, and the label's `for` are written in the markup. The switch has to
  work before any script runs, and `name` is what carries the value into the form.
- Reference the description with `aria-describedby`. Folding it into the label would make
  the accessible name a paragraph long.

## Public API

Support `size` (`md` or `sm`), `placement` (`end` or `start`), and `pending` as
attributes. Expose `checked`, `pending`, `commit`, `control`, and `labels`.

**Add no `switch-change` event.** The native `change` already bubbles past the host, and a
second one would give consumers two ways to hear the same toggle. Emit only
`switch-pending` with `{ pending, checked }` and `switch-error` with
`{ reason, checked, requested }`.

## The pending commit

`commit` is an async function the consumer assigns. On a toggle, run it, lock the switch,
and on rejection put the switch back where it was — showing a state the server never
accepted is a lie.

- Lock by cancelling the click, **not** by setting `disabled`. A disabled element loses
  focus, which drops a keyboard user back at the top of the document mid-task. Use
  `aria-disabled="true"` and a capture-phase `click` handler that calls `preventDefault`.
  The handler must sit on the host so it catches the label as well as the track.
- `aria-disabled` needs the literal string `"true"`. Unlike `aria-invalid`, an empty value
  is read as false.
- Restore with a plain assignment to `checked`. Assignment does not fire `change`, so the
  restore cannot re-enter the commit that caused it.
- Announce the direction of travel and the failure through a `role="status"` region that
  is in the document before it is needed.

## Presentation and accessibility

- Set `role="switch"` on the checkbox and **never write `aria-checked`**. A native
  checkbox under that role exposes its own checked state; a second copy would only have
  somewhere to go stale.
- The thumb's position is the primary signal, so the state does not rest on colour.
- The label names the setting and does not change with the state. A control whose label
  alternates between "Turn on" and "Turn off" is a button, and should be built as one.
- `Space` toggles and `Enter` is left alone. Inside a form Enter submits.
- Read the disabled state with `:disabled`, not `control.disabled`. An input inside a
  disabled `fieldset` reports `false` from its own property while the browser still
  refuses to operate it.
- Offer no `readonly`: the browser ignores it on a checkbox, as it does on a radio.
- Meet 3:1 on the off-track edge, the thumb edge against the off track, the on-track fill,
  and the thumb against the on track.
- The compact track is under the 24px WCAG 2.2 asks for, so carry the hit area with an
  invisible `::after` rather than repainting it larger.
- Transitions cover the track colour and the thumb position at `160ms`.
  `prefers-reduced-motion: reduce` removes them and stops the spinner; the dimmed track
  and the status message still report the busy state.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Turn scripting off: the control is still drawn as a switch and still toggles.
- The accessibility inspector reports the switch role and the right on/off state, with no
  `aria-checked` in the markup.
- While a save is running, the switch cannot be moved by the track, the label, or the
  Space key, and focus does not leave it.
- A save that fails leaves the switch where it started and says why.
- A switch inside a disabled `fieldset` looks unavailable and is left out of the
  submission.
- Space toggles, Enter submits the form.
- Clicking the label toggles the switch from either side of the row.
