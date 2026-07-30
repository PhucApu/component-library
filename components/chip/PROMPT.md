# Recreate Chip

You are a Senior Frontend Engineer. Build a Web Component named `<ui-chip>` using plain HTML, CSS,
and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a backend, or a
new dependency.

## The central instruction

A chip is a shape, not a control. Five different things share it:

| Use | Element |
|---|---|
| Presents information | `span` |
| Runs an action | `button` |
| Goes somewhere | `a` |
| Toggles a filter | `button` with `aria-pressed` |
| A token you can remove | `span` plus a sibling remove `button` |

The author writes the element that matches the behavior. The component never rewrites it; it adds
the shell, the remove button, the states, and the events. Collapsing these into one element
switched by attributes is how a chip ends up announced as the wrong thing.

**Never nest a button inside a button or a link.** That is invalid markup and assistive technology
treats it unpredictably. A chip that both acts and removes is two adjacent controls in one pill,
with two tab stops.

## Output

Create a portable component with this structure:

```text
components/chip/
|-- component.json
|-- README.md
|-- DESIGN.md
|-- PROMPT.md
|-- PROMPT-STANDALONE.md
|-- preview/thumbnail.svg
`-- source/
    |-- chip-core.js
    |-- demo.js
    |-- shared.css
    |-- shared.js
    `-- variants/
        |-- static/index.html
        |-- removable/index.html
        |-- action/index.html
        |-- filter/index.html
        |-- adorned/index.html
        `-- appearance/index.html
```

Use manifest schema version 2, component version `0.1.0`, group `data-display`, and English
variant descriptions. Each entry runs directly in a browser or iframe, uses `lang="en"`, and stays
independent from catalog code.

Group `data-display` rather than `inputs`: the taxonomy question is what a component produces, and
a chip presents a token rather than owning a value.

Keep DOM-free rules in `chip-core.js` so they can be unit tested under `node:test`. `shared.js`
extends `HTMLElement` and cannot be imported that way.

Packaging concatenates the root modules into one script sharing a single top-level scope, so no
two may declare the same top-level name. The component must define every CSS custom property it
reads and must not reference any `catalog/` path; validation rejects both.

The catalog thumbnail is a static, self-contained `640x360` SVG showing removable chips above a
row of status chips. No animation, script, external asset, or embedded raster image.

## Public API

Support `appearance` (`filled` or `outlined`), `intent` (`neutral`, `accent`, `success`,
`warning`, `danger`), `size` (`md` or `sm`), `removable`, `selected`, and `disabled` as
attributes. Expose `control`, `label`, and `labels`.

Report through:

```js
new CustomEvent('chip-remove', { detail: { label }, bubbles: true, composed: true });
new CustomEvent('chip-toggle', { detail: { selected, label }, bubbles: true, composed: true });
```

The chip never removes itself. Whether the token disappears is the consumer's decision, so report
the request and stop there.

## Behavior

- `removable` appends a remove button as a sibling of the author's control, with an accessible
  name that folds in the chip's own text. A row of chips must not become a row of identical
  "Remove" buttons.
- Backspace and Delete report a removal, but only while focus is inside the chip, so the keys
  still edit text elsewhere on the page.
- A control carrying `aria-pressed` toggles `selected` and reports `chip-toggle`, keeping the
  attribute and the styling in step.
- A disabled chip blocks activation before it reaches the author's element.

## Disabling a link

`disabled` is not an attribute on `<a>`; the browser ignores it, so a link chip that merely looked
disabled would still navigate. When disabled, remove `href` from the anchor, which also drops it
from the tab order, add `aria-disabled`, and block activation. Store the original `href` and
restore it when the chip is enabled.

Buttons take the native `disabled` attribute and need none of that.

## Presentation and accessibility

- Style the author's control through a class rather than by tag, so a span, a button, and an
  anchor look identical while each keeps its own behavior.
- Build intent palettes as soft tinted surfaces carrying strong text, not saturated fills. A solid
  warning fill with white text is the usual way a chip fails contrast at this text size. Verify
  every intent reaches `4.5:1` for its label in both appearances and both themes.
- Do not make a static chip focusable. A plain label as a tab stop asks keyboard users to visit
  something they cannot act on.
- Use `aria-pressed` for toggles, not `aria-selected`, which requires a listbox, grid, or tab
  context that a loose row of chips does not provide.
- Show selection with a check as well as the surface, and disabled with dimming plus a blocked
  cursor, so neither depends on colour alone.
- Put focus rings on the interactive elements themselves so exactly one indicator appears.
- Accept adornments as light-DOM children: an avatar, a leading icon, a trailing count. Hide
  decorative marks from assistive technology; an avatar standing in for a person carries its own
  name.
- Keep labels on one line and let rows of chips wrap.
- Limit transitions to background at `140ms` and remove them under
  `prefers-reduced-motion: reduce`.

## Tests and delivery

Write `node:test` coverage for attribute normalisation, the remove-label composition including an
empty label, whitespace collapsing, and the rule that decides whether an element can be disabled
natively or must be emulated.

Write Playwright coverage for all six variants, removing by button and by key, the reported label,
toggling and `aria-pressed`, the disabled button, adornments, mobile wrapping, reduced motion,
document downloads, and the packaged ZIP.

Cover these explicitly, because each is the point of the design:

- No interactive element is nested inside another anywhere in the rendered output. Assert that
  `button button`, `a button`, and `button a` all match nothing.
- A static chip is not reachable by Tab.
- A disabled link chip does not navigate and has no `href`.
- Every intent reaches `4.5:1` for its label against its surface, measured rather than eyeballed.

Run English validation, component validation, registry generation, preview generation, packaging,
publishing, and the full repository verification flow.
