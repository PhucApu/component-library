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

## Output

Create a portable component with this structure:

```text
components/switch/
|-- component.json
|-- README.md
|-- DESIGN.md
|-- PROMPT.md
|-- PROMPT-STANDALONE.md
|-- preview/thumbnail.svg
`-- source/
    |-- demo.js
    |-- shared.css
    |-- shared.js
    |-- switch-core.js
    `-- variants/
        |-- default/index.html
        |-- placement/index.html
        |-- descriptions/index.html
        |-- group/index.html
        |-- pending/index.html
        `-- restricted/index.html
```

Use manifest schema version 2, component version `0.1.0`, group `inputs`, and English
variant descriptions. Each entry runs directly in a browser or iframe, uses `lang="en"`,
and stays independent from catalog code.

Keep DOM-free rules in `switch-core.js` so they can be unit tested under `node:test`.
`shared.js` extends `HTMLElement` and cannot be imported that way.

Packaging concatenates the root modules into one script sharing a single top-level scope,
so no two may declare the same top-level name. The component must define every CSS custom
property it reads and must not reference any `catalog/` path; validation rejects both.

The catalog thumbnail is a static, self-contained `640x360` SVG of the Group variant with
some switches on and some off. No animation, script, external asset, or embedded raster
image.

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

## Tests and delivery

Write `node:test` coverage for size and placement normalisation, the rule that decides
whether a toggle is blocked, template filling including the unlabelled case, and the
status and failure wording in both directions.

Write Playwright coverage for all six variants, the label, the keyboard, form submission,
mobile layout, reduced motion, document downloads, and the packaged ZIP.

Cover these explicitly, because each is a place this component can quietly go wrong:

- With scripting disabled the control is still drawn as a switch and still toggles.
- `aria-checked` is absent and the accessibility tree still reports on and off. Read the
  real tree over CDP rather than trusting the attributes.
- A pending commit cannot be toggled by track, label, or keyboard, and never moves focus.
  Hold the request open with a promise that never settles so the test is not a race, and
  force the clicks: Playwright reads `aria-disabled` and would refuse on its own.
- A rejected commit returns the switch to its previous state, in both directions.
- A disabled switch is left out of the submission whether the attribute is on the input or
  on a surrounding `fieldset`.
- Space toggles and Enter does not.

Run English validation, component validation, registry generation, preview generation,
packaging, publishing, and the full repository verification flow.
