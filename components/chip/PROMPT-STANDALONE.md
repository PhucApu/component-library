# Recreate Chip as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-chip>` using plain HTML, CSS,
and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a backend, or a
new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

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

Produce exactly these files, flat, with no subdirectories:

```text
chip.html
chip.css
chip.js
README.md
```

- `chip.js` is one ES module holding the DOM-free rules, the custom element, and the demo
  bootstrap. It defines the element only when it is not already registered.
- `chip.css` holds every style, driven by component-owned CSS custom properties.
- `chip.html` is a runnable example showing each use and reporting events into an `<output>`.
- `README.md` documents why the markup belongs to the author, the attribute table, the events, and
  browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page must
be served over HTTP or HTTPS.

## Markup

```html
<ui-chip><span>Design</span></ui-chip>
<ui-chip><button type="button">Add label</button></ui-chip>
<ui-chip><a href="/tags/design">Design</a></ui-chip>
<ui-chip><button type="button" aria-pressed="false">Open</button></ui-chip>
<ui-chip removable><span>Ha Linh</span></ui-chip>
```

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

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- No interactive element is nested inside another: `button button`, `a button`, and `button a`
  match nothing in the rendered page.
- Tab skips a static chip and stops on every button, link, and remove button.
- A disabled link chip does not navigate and has no `href`.
- A disabled button chip cannot be activated.
- Removing reports the chip's own text, not a generic name, and the chip stays until you remove
  it.
- Backspace removes while focus is inside a chip and does nothing while focus is in a text field.
- Each intent's label reaches `4.5:1` against its surface, measured rather than eyeballed.
