# Recreate Switch

You are a Senior Frontend Engineer. Build a Web Component named `<ui-switch>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

## The central instruction

A switch is a native `input type="checkbox"`, restyled. Draw the track and the thumb in
CSS **on the checkbox itself** with `appearance: none` and a `::before` thumb, so the
control renders and toggles with no script running. Script adds only what CSS cannot: the
`switch` role, the description wiring, and the pending state.

Keep in mind what separates a switch from a checkbox: a checkbox is a selection applied
when the form is submitted, a switch takes effect immediately. Every decision below
follows from that.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement
is configuration, not a separate build.

- **Default**: a single switch off and on, at the standard and the compact size.
- **Placement**: the label following the switch, and the label leading a full-width row.
- **Descriptions**: settings rows pairing each label with a line of supporting text.
- **Group**: related switches under a legend inside a form.
- **Pending**: switches backed by an asynchronous commit, one of which fails.
- **Restricted**: unavailable switches in both states, beside a group disabled as a whole.

Each has to run on its own, loading nothing from another origin.

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
- Define every CSS custom property the component reads inside the component itself, and
  reference nothing outside it. That is what lets the switch be lifted into another
  project unchanged.

## Verify before calling it done

Keep the rules that decide things — normalising an attribute, choosing the wording of a
message, deciding whether a press is blocked — reachable without a browser, so they can be
tested on their own.

Check these explicitly, because each is a place this component quietly goes wrong:

- With scripting disabled the control is still drawn as a switch and still toggles.
- `aria-checked` is absent and the accessibility tree still reports on and off. Read the
  tree the browser actually exposes rather than trusting the attributes.
- A pending commit cannot be toggled by track, label, or keyboard, and never moves focus.
  Hold the request open with a promise that never settles, or the check becomes a race
  against the timeout; and force the press, because automation tools read `aria-disabled`
  and refuse to click on their own.
- A rejected commit returns the switch to its previous state, in both directions.
- A disabled switch is left out of the submission whether the attribute is on the input or
  on a surrounding `fieldset`.
- Space toggles and Enter does not.
