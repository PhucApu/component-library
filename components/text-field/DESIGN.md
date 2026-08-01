# Text Field - Design Specification

## 1. Purpose

Collect a line or a paragraph of text. The component owns the frame, the states, and the wiring
between a field and the words that describe it. The browser owns the input.

## 2. Enhance, do not replace

`input` and `textarea` already provide typing, selection, input methods, autofill, undo, form
submission, the correct mobile keyboard through `type` and `inputmode`, spellcheck, and constraint
validation. Rebuilding any of it would be a downgrade, so this element never rewrites its own
markup.

This is the same decision as Radio Group, and the opposite of Temporal Picker and Autocomplete,
which build their controls because HTML offers no equivalent.

## 3. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog.

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--text-field-surface` | `#ffffff` | `#171a20` | Outlined frame background |
| `--text-field-surface-filled` | `#f1f4f9` | `#1d2128` | Filled and read-only background |
| `--text-field-text` | `#111827` | `#f4f6fa` | Label and value |
| `--text-field-muted` | `#5f6878` | `#a8afbc` | Hint, placeholder, adornments |
| `--text-field-border` | `#cbd5e1` | `#3b414c` | Frame at rest |
| `--text-field-border-strong` | `#94a3b8` | `#5a6272` | Frame on hover |
| `--text-field-accent` | `#4f46e5` | `#4968e8` | Frame on focus |
| `--text-field-focus` | `#6366f1` | `#86a0ff` | Focus ring |
| `--text-field-danger` | `#b42318` | `#ff8e87` | Invalid frame and message |
| `--text-field-radius` | `10px` | | Frame radius |

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

## 4. Anatomy

1. A `label` above the frame, associated by `for` and `id`.
2. `.text-field__control`, the visible frame, holding the input and any adornments.
3. An optional hint paragraph below.
4. An error paragraph the component adds and removes.
5. An optional counter, plus a separate polite region for announcing it.

## 5. The label sits above the field

Not a floating label. A floating label is read as a value already entered, truncates on narrow
screens, and breaks up when text is enlarged. A static label stays legible while typing and
survives a long string, which matters more than the height it costs.

## 6. When an error appears

An empty required field is invalid from the moment it renders. Styling on validity alone would
paint a whole form red before anyone typed, so the visual state uses `:user-invalid`, which only
matches after interaction, and `aria-invalid` is set on the same terms so the announcement matches
the screen.

The message comes from the browser, already translated. An author-supplied `error` wins, because
only the author knows the domain rule behind a `pattern`.

## 7. No duplicate change event

The native control already emits `input` and `change`, and both bubble past the host. Adding
`text-field-change` would give consumers two ways to hear the same edit and an easy way to handle
it twice.

Only `text-field-validity` is added, because the moment a field decides to report a problem is
information the platform does not provide.

## 8. States

Resting, hover, focus, invalid, read-only, disabled, and the counter's near-limit state.

The frame owns the focus ring; the input inside draws none. A text input matches `:focus-visible`
even on a mouse click and would stack a second outline inside a surface already showing focus.

Hover is guarded with `:not(:focus-within)`. Without that guard the hover rule is more specific
than the focus rule, so a clicked field would keep its hover colour for as long as the pointer
rested on it.

## 9. Read-only against disabled

Both stop editing and differ in submission: a read-only field is focusable, selectable, and
**submitted**; a disabled field is skipped by the keyboard and omitted from the form data. Both
attributes are real here, unlike a radio group where the browser ignores `readonly` entirely.

## 10. Two traps in reading and redrawing

`checkValidity()` fires an `invalid` event. An element that both listens for `invalid` and calls
`checkValidity()` while handling it recurses until the stack gives out. Read `validity.valid`
instead; only call `checkValidity()` when the event is what you want.

The reveal button redraws its icon only when the state changes. Rewriting its markup on every sync
destroys the path the pointer pressed down on, and a click whose mousedown target no longer exists
never reaches the button, so every second press is swallowed.

## 11. The counter must not narrate

A counter bound to a live region announces a number after every keystroke, which buries the
content being written. The visible counter is `aria-hidden`, and a separate polite region speaks
only as the limit approaches, and only when the message changes.

## 11. Responsive behavior and motion

- The field fills its container; sizing is the consumer's decision.
- Adornments hold their width while the input takes the rest.
- Transitions cover border and shadow at `140ms`; `prefers-reduced-motion: reduce` removes them.

## 12. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Validation variant with one focused
field and one showing an error. It is self-contained with no animation, script, external asset, or
embedded raster image.

## 13. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- A required field is not marked invalid before the person interacts with it.
- The counter is outside any live region.
- A read-only value appears in the submitted data and a disabled one does not.
- With scripting disabled the fields still accept text and the form still submits.
- Exactly one focus indicator is visible.
