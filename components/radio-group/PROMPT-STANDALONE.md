# Recreate Radio Group as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-radio-group>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## The central instruction

HTML already implements this control. Radio inputs sharing a `name` provide single selection,
arrow-key movement, roving focus, skipping of disabled options, and form submission. A `fieldset`
with a `legend` provides the accessible group name.

Enhance that; do not replace it. The element must never rewrite its own markup and must never
intercept a key. Restyle the native input in place with `appearance: none`, assign the shared
name, mirror the chosen value, and report changes.

Rebuilding this with `role="radiogroup"` and `role="radio"` would be more code and a worse
result. The group must keep working with scripting disabled, losing only the value API.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
radio-group.html
radio-group.css
radio-group.js
README.md
```

- `radio-group.js` is one ES module holding the DOM-free rules, the custom element, and the demo
  bootstrap. It defines the element only when it is not already registered.
- `radio-group.css` holds every style, driven by component-owned CSS custom properties.
- `radio-group.html` is a runnable example loading the other two and printing the chosen value
  into an `<output>` element.
- `README.md` documents the markup contract, the attribute table, the value contract, and browser
  support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page must
be served over HTTP or HTTPS, while noting the radios themselves would still work.

## Markup contract

```html
<ui-radio-group name="plan" value="pro" layout="row" appearance="card">
  <fieldset>
    <legend>Choose a plan</legend>
    <div class="radio-group__options">
      <label>
        <input type="radio" name="plan" value="free" />
        <span class="radio-group__text">
          Free
          <small>One project and community support.</small>
        </span>
      </label>
    </div>
  </fieldset>
</ui-radio-group>
```

- `fieldset` and `legend` name the group. Add no ARIA role: the native grouping is already correct
  and a role would override it.
- `radio-group__options` is the layout container.
- Every input carries the shared `name` in the markup. That is what makes the browser treat them
  as one group, and it must be present before any script runs or the no-script guarantee is
  false. Fill in a missing name as a safety net, and generate a unique one when the author
  supplies none, but write the name into every documented example.
- An input with no `value` submits `"on"`, which cannot distinguish options, so exclude those from
  the model.

## Public API

Support `name`, `value`, `layout` (`stack` or `row`), `appearance` (`control` or `card`), `size`
(`md` or `sm`), `disabled`, and `error` as attributes. Expose read-only `options` and
`checkedValue`, plus `select(value)` which refuses a missing or disabled value and returns
`false`.

Report changes through:

```js
new CustomEvent('radio-group-change', {
  detail: { value, name },
  bubbles: true,
  composed: true,
});
```

## Value contract

`value` is the chosen radio's value, or `""` when nothing is chosen. An empty value is a valid
resting state, not an error. Preserve a value that matches no option and mark the group invalid;
rewriting it to blank would hide the consumer's mistake.

**Do not make this controlled-first.** A native radio checks itself the instant it is clicked, so
emitting a proposal and leaving `value` untouched would mean undoing the browser on every
interaction and flickering the selection. Follow the platform: the choice sticks, `value` mirrors
it, and the event lets a consumer override by assigning `value` back.

## Configurations to support

One element serves them all; each is configuration, not a separate build.

- Vertical list and wrapping row through `layout`.
- Supporting text under a label using `small` inside the label.
- A card appearance where the whole surface is the target rather than only the dot.
- A required group showing an error message.
- Individually unavailable options and a disabled group.

## Presentation and accessibility

- Restyle the input with `appearance: none`; draw the chosen dot with an inset ring so it scales
  with the control size.
- Put the focus ring on the input itself. It is the real control, so nothing else in the option
  may draw a second outline.
- Carry selection on a card with both border colour and the dot, never fill alone.
- Mark unavailable options `disabled` natively, which also removes them from arrow-key order.
- Give the error message `role="alert"` and link it from the fieldset with `aria-describedby`.
  Create that element once and reuse it; recreating it breaks the reference.
- Set `aria-invalid` on the inputs while the group is invalid.
- Offer no `readonly`. HTML ignores it on radio inputs, so it would be an attribute that silently
  does nothing. Document the omission.
- Let the row layout wrap, and flex cards from a `12rem` basis so a row reflows into a column.
- Limit transitions to border and background at `140ms` and remove them under
  `prefers-reduced-motion: reduce`.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Turn scripting off: the group still selects, arrow keys still move between options, and a form
  submit still carries the chosen value.
- Arrow keys skip a disabled option.
- Radios given no `name` in the markup still behave as one group, so choosing one clears another.
- Exactly one focus indicator is visible when an option is focused.
- Setting `value` to something no option offers keeps the text and marks the group invalid.
- The card appearance shows selection through its border as well as the dot.
