# Autocomplete - Design Specification

## 1. Purpose

Let a person narrow a list by typing and commit either one value or several. The component owns
its filtering, its floating suggestion surface, and its keyboard model, and carries its own
design tokens so a download runs without catalog CSS.

## 2. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog.

| Token | Light | Role |
|---|---|---|
| `--autocomplete-surface` | `#ffffff` | Field and list background |
| `--autocomplete-surface-subtle` | `#f8fafc` | Hover and active row |
| `--autocomplete-text` | `#111827` | Primary text |
| `--autocomplete-muted` | `#5f6878` | Placeholder, group heading, messages |
| `--autocomplete-border` | `#cbd5e1` | Field and list border |
| `--autocomplete-accent` | `#4f46e5` | Focus border, active ring, selected check |
| `--autocomplete-focus` | `#6366f1` | Focus ring |
| `--autocomplete-danger` | `#b42318` | Invalid border and error message |
| `--autocomplete-chip` | `#eef2ff` | Chip background |
| `--autocomplete-mark` | `#fde68a` | Matched text background |
| `--autocomplete-radius` | `12px` | Field radius |
| `--autocomplete-shadow` | large soft shadow | List elevation |

The demo page overrides the same names for its dark presentation. A consumer retheme is the same
operation.

## 3. Anatomy

1. Field: a text input, the chips that precede it in `multiple` mode, a clear button, and a
   toggle button.
2. Floating listbox in its own layer, anchored under the field.
3. Screen-reader-only live status for result counts.
4. Screen-reader-only validation message.

The native Popover API is preferred. The fallback portals the list to `document.body` and uses
fixed positioning.

## 4. Value contract

| Mode | Format | Empty |
|---|---|---|
| `single` | The chosen option's value | `""` |
| `multiple` | JSON array of values | `"[]"` |

A JSON array rather than a delimited string, so a value may contain any character including a
comma without an escaping rule.

- Duplicate values collapse to the first occurrence.
- A malformed value, or a value matching no option while `free-text` is absent, is preserved and
  the field is marked `aria-invalid`. Discarding what the consumer set would hide their bug.
- `free-text` accepts any typed value, so nothing is unknown and the field never goes invalid on
  that ground.

## 5. Variants

`single`, `multiple`, `free-text`, `grouped`, `async`, and `restricted` all run one
implementation. A variant is configuration, not a separate build.

`async` simulates a delayed load with local data because the catalog ships no backend. It still
exercises the real loading, error, and recovery paths.

## 6. Filtering and marking

Comparison folds both sides to lower case without diacritics, so an unaccented query finds an
accented label. NFD separates combining marks so they can be dropped, but a stroke drawn through
a glyph is part of the letter and survives, so those letters are mapped by hand.

The rule is substring containment, not fuzzy matching, so results stay predictable.

Marking splits the label into plain and matched segments over the folded text while reporting
offsets into the original, so the author's own characters are rendered. **Every segment is escaped
before any markup is added**: a label is data, and an option containing angle brackets must appear
as text rather than be parsed.

## 7. Interaction

- Click, typing, or Arrow Down opens the list. `min-chars` can defer opening until enough
  characters exist.
- Opening, and every change to the query, activates the first available option. Enter therefore
  commits the top match without an arrow key, which is what a filtering field is for. The first
  Arrow Down consequently moves to the second option rather than the first.
- Arrow keys move through available options only; disabled options and group headings are skipped.
- Enter selects the active option. With `free-text` and no active option, Enter commits the
  trimmed query.
- Escape closes the list. Tab closes it without selecting.
- In `multiple` mode, Backspace on an empty query removes the last chip, and selecting an already
  selected option removes it.
- Pointer activity outside the field and the list closes the list.
- Choosing a value in `single` mode closes the list and restores focus to the input.
- Abandoning a query in `single` mode restores the committed label rather than leaving stray text.

## 8. States

Default, hover, focus, open, loading, error, empty, no results, selected, active, unavailable,
invalid, read-only, and disabled. Unavailable options carry a strike-through so the state is not
signalled by colour alone.

The field is the visual control and owns the focus indicator for the whole widget: an accent
border plus a soft ring. The inner input draws no outline of its own, because a text input
matches `:focus-visible` even on a mouse click and would stack a second rectangle inside a
surface that is already showing focus.

Hover must not be more specific than focus. A hover rule qualified with `:not()` guards outranks
a plain focus class, which would leave the focused field wearing its hover colour for as long as
the pointer rested on it, which is the whole time after a click.

## 9. Responsive behavior and motion

- The list matches the field width, sits `4px` below it, keeps `12px` viewport padding, and caps
  its scroll height at `288px`.
- It flips above the field only when the space below cannot hold a usable list. Flipping merely
  because the preferred height does not fit would cover the field's own context.
- The field wraps its chips onto more rows rather than overflowing horizontally. Only the entry
  area wraps: the clear and toggle buttons sit in their own block, pinned to the right and
  centred vertically however tall the field grows. As direct children of a wrapping field they
  would be carried onto the last row along with the chips.
- Transitions are limited to border and shadow at `140ms`; `prefers-reduced-motion: reduce`
  removes them.

## 10. Accessibility

- The input is `role="combobox"` with `aria-expanded`, `aria-controls`, `aria-activedescendant`,
  and `aria-autocomplete="list"`.
- Options are `role="option"` with `aria-selected` and `aria-disabled`; groups are `role="group"`
  with an accessible name, and their visible heading is `aria-hidden` because the group already
  carries the name.
- Focus never leaves the input while the list is open, which is what `aria-activedescendant`
  exists for.
- Result counts and no-results go to a screen-reader-only live region. The count is never shown
  visually.
- Each chip has its own remove button named after the option.

## 11. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Multiple variant with two chips and
an open, filtered list. It is self-contained with no animation, script, external asset, or
embedded raster image.

## 12. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- Filtering ignores case and diacritics, and the marked run renders the original characters.
- A label containing markup is shown as text.
- Keyboard navigation skips disabled options and group headings.
- The list is never clipped by an ancestor's overflow.
- A malformed or unknown value survives and marks the field invalid.
