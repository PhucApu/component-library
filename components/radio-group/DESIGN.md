# Radio Group - Design Specification

## 1. Purpose

Let a person choose exactly one option from a small, visible set. The component supplies the
visual system and the value API; the browser supplies the behavior.

## 2. The central decision: enhance, do not replace

HTML already implements this control. Radio inputs sharing a `name` give single selection,
arrow-key movement between options, roving focus, skipping of disabled options, and form
submission. A `fieldset` with a `legend` gives the group its accessible name.

So this component never rewrites its own markup and never intercepts a key. It restyles the native
input in place with `appearance: none`, assigns the shared name, mirrors the chosen value, and
reports changes.

Two consequences worth stating plainly:

- The group keeps working with no JavaScript, provided the markup carries a shared `name` on every
  input. Only the `value` API and the change event are lost. The element fills in a missing name,
  but that is a safety net running after the script does; radios relying on it are separate groups
  until then.
- The whole class of focus bugs that comes from re-rendering a control cannot occur here, because
  nothing is ever re-rendered.

This is the opposite of Temporal Picker and Autocomplete, which build their controls because HTML
offers no equivalent.

## 3. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog.

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--radio-group-surface` | `#ffffff` | `#171a20` | Control and card background |
| `--radio-group-surface-subtle` | `#f8fafc` | `#1d2128` | Disabled surface |
| `--radio-group-text` | `#111827` | `#f4f6fa` | Label and legend |
| `--radio-group-muted` | `#5f6878` | `#a8afbc` | Supporting text |
| `--radio-group-border` | `#cbd5e1` | `#3b414c` | Card border |
| `--radio-group-border-strong` | `#94a3b8` | `#5a6272` | Control ring at rest |
| `--radio-group-accent` | `#4f46e5` | `#4968e8` | Chosen control and card border |
| `--radio-group-accent-soft` | `#eef2ff` | `#1b2338` | Chosen card background |
| `--radio-group-focus` | `#6366f1` | `#86a0ff` | Focus ring |
| `--radio-group-danger` | `#b42318` | `#ff8e87` | Error border and message |
| `--radio-group-radius` | `12px` | | Card radius |

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

## 4. Anatomy

1. `fieldset` wrapping the group, with a `legend` naming it.
2. A `radio-group__options` container that owns the layout.
3. One `label` per option holding a native radio and its text.
4. Optional `small` supporting text inside the label.
5. An error paragraph appended to the fieldset and linked with `aria-describedby`.

## 5. Value contract

`value` is the chosen radio's value, or `""` when nothing is chosen. An empty value is a valid
resting state, not an error.

- A value matching no option is preserved and the group is marked invalid. Rewriting it to blank
  would hide the consumer's mistake.
- An input with no `value` attribute submits `"on"`, which cannot distinguish options, so such
  inputs are excluded from the model.
- `select(value)` refuses a missing or disabled value and reports `false`.

**This component is not controlled-first.** Temporal Picker and Autocomplete emit a proposed value
and leave `value` untouched. A native radio checks itself the moment it is clicked, so matching
that pattern would mean undoing the browser's work on every interaction and flickering the
selection. Following the platform is the better trade: the choice sticks, `value` mirrors it, and
`radio-group-change` lets a consumer override by assigning `value` back.

## 6. Variants

`default`, `horizontal`, `descriptions`, `cards`, `validation`, and `restricted` all run one
implementation. A variant is configuration through `layout`, `appearance`, and state attributes.

## 7. States

Resting, hover, focus, checked, checked and hovered, disabled, disabled and checked, invalid, and
disabled group.

The focus ring sits on the input, which is the real control, so there is exactly one focus
indicator. A card carries selection with both its border colour and the dot, never by fill alone.
An unavailable option is disabled natively, so the browser also removes it from arrow-key order.

## 8. Responsive behavior and motion

- The row layout wraps rather than overflowing.
- Cards flex from a `12rem` basis so a row reflows into a column on narrow screens.
- Transitions cover border and background at `140ms`; `prefers-reduced-motion: reduce` removes
  them.

## 9. Accessibility

- `fieldset` and `legend` name the group; no ARIA role is added, because the native grouping is
  already correct and a role would only override it.
- Each option is labelled by its own `label`, so supporting text inside the label is part of the
  accessible name.
- The error message uses `role="alert"` and is referenced by `aria-describedby` on the fieldset.
- `aria-invalid` is set on the inputs while the group is invalid.
- No `readonly`: HTML ignores it on radio inputs, so offering it would be an attribute that does
  nothing.

## 10. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Cards variant with the middle
option chosen. It is self-contained with no animation, script, external asset, or embedded raster
image.

## 11. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- With scripting disabled the group still selects, still moves under arrow keys, and still submits.
- Arrow keys skip disabled options.
- A value matching no option survives and marks the group invalid.
- Exactly one focus indicator is visible.
- Radios without an author-supplied name still behave as one group.
