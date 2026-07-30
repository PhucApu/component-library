# Recreate Autocomplete as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-autocomplete>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
autocomplete.html
autocomplete.css
autocomplete.js
README.md
```

- `autocomplete.js` is one ES module holding the whole component: the DOM-free rules, the custom
  element, and the demo bootstrap. It defines the element only when it is not already registered.
- `autocomplete.css` holds every style, namespaced under `autocomplete__*`, driven by
  component-owned CSS custom properties.
- `autocomplete.html` is a runnable example loading the other two, showing one field in
  `multiple` mode, and printing the committed value into an `<output>` element.
- `README.md` documents installation, how to declare options, the attribute table, the value
  contract, and browser support.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page must
be served over HTTP or HTTPS.

Add a comment beside the `<ui-autocomplete>` tag listing the selectable modes and the `free-text`
option, so a reader discovers the other configurations without opening the README.

## Public API

```html
<ui-autocomplete
  mode="multiple"
  value='["css","accessibility"]'
  free-text
  placeholder="Add a skill"
  min-chars="0"
  aria-label="Choose the required skills"
>
  <option value="css">CSS</option>
</ui-autocomplete>
```

Support `mode`, `value`, `free-text`, `disabled`, `readonly`, `placeholder`, `loading`, `error`,
`min-chars`, and `aria-label` as attributes. Expose `options`, `selectedOptions`, and `labels` as
properties. `labels` accepts a partial object for consumer localization.

Commit through:

```js
new CustomEvent('autocomplete-change', {
  detail: { value, mode, selected },
  bubbles: true,
  composed: true,
});
```

Controlled-first: emit a proposed value, never write it back to `value`. External `value` updates
resynchronize the selection.

## Option source

Read `option` and `optgroup` children as the declarative source, because HTML already has these
primitives. An `option` without a `value` uses its text content. Read them once, before the
element replaces its own markup.

The `options` property accepts `{ value, label, group, disabled }` objects and replaces the
declared list. Drop malformed entries and later duplicates of a value.

## Value contract

| Mode | Format | Empty |
|---|---|---|
| `single` | The chosen option's value | `""` |
| `multiple` | JSON array of values | `"[]"` |

Use a JSON array rather than a delimited string so a value may contain any character, including a
comma, without an escaping rule.

- Duplicate values collapse to the first occurrence.
- Preserve a malformed value, or one matching no option while `free-text` is absent, and mark the
  field `aria-invalid`. Never discard what the consumer set.
- `free-text` accepts any typed value, so nothing is unknown on that path.

## Filtering and marking

- Fold both sides to lower case without diacritics so an unaccented query finds an accented
  label. Decompose with NFD and strip combining marks, then map by hand the letters whose stroke
  is drawn through the glyph, because NFD leaves those intact.
- Match by substring containment, not fuzzy matching, so results stay predictable.
- Split the label into plain and matched segments over the folded text while reporting offsets
  into the original, so the author's own characters are rendered.
- **Escape every segment before adding any markup.** A label is data. An option containing angle
  brackets must render as text; this is the component's one injection surface.

## Modes

One element serves every mode; the mode is configuration, not a separate build.

- `single`: choose one option from the list.
- `multiple`: chips for each choice, removable individually.
- Add `free-text` to accept a typed value that matches no option.
- Declare `optgroup` labels to group options.
- Set `loading` and `error` while data is being fetched, and assign `options` when it arrives.
- Combine disabled options with `readonly` or `disabled` for blocked states.

## Interaction, responsive behavior, and accessibility

- Click, typing, or Arrow Down opens the list. `min-chars` defers opening.
- Opening, and every query change, activates the first available option, so Enter commits the top
  match without an arrow key. The first Arrow Down then moves to the second option.
- Arrow keys move through available options only. Disabled options and group headings are skipped.
- Enter selects the active option; with `free-text` and no active option it commits the trimmed
  query. Escape closes the list. Tab closes it without selecting.
- In `multiple` mode, Backspace on an empty query removes the last chip, and selecting an already
  selected option removes it.
- Pointer activity outside the field and list closes the list.
- Choosing a value in `single` mode closes the list and returns focus to the input. Abandoning a
  query restores the committed label rather than leaving stray text.
- Render the list in its own floating layer. An ancestor with overflow would clip it.
- Match the field width, sit `4px` below, keep `12px` viewport padding, cap scroll height near
  `288px`, and flip above only when the space below cannot hold a usable list.
- Let the entry area wrap chips onto more rows rather than overflow horizontally, and keep the
  clear and toggle buttons in a separate block pinned right and centred vertically. As direct
  children of a wrapping field they get carried onto the last row with the chips.
- Create the input element once and never re-render it. Replacing it drops focus and the caret on
  every keystroke.
- Give the field the focus indicator and suppress the inner input's own outline: a text input
  matches `:focus-visible` even on a mouse click, so it would draw a second rectangle inside a
  surface already showing focus.
- Keep the focus rule at least as specific as the hover rule. A hover selector carrying `:not()`
  guards outranks a plain focus class, leaving a clicked field stuck on its hover colour.
- Use `role="combobox"` with `aria-expanded`, `aria-controls`, `aria-activedescendant`, and
  `aria-autocomplete="list"`; `role="option"` with `aria-selected` and `aria-disabled`; and
  `role="group"` with an accessible name, its visible heading `aria-hidden`.
- Report result counts through a screen-reader-only live region; never show the count visually.
- Mark unavailable options with a strike-through as well as colour.
- Give each chip its own remove button named after the option.
- Limit transitions to border and shadow at `140ms` and remove them under
  `prefers-reduced-motion: reduce`.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- An unaccented query matches an accented option label, and the marked run shows the original
  accented characters rather than the folded ones.
- An option labelled `a<script>b` renders as text, with no script executed.
- Arrow keys never land on a disabled option or a group heading.
- The list is not clipped when the field sits inside a container with `overflow: auto`.
- In `multiple` mode, Backspace on an empty query removes the last chip, and reselecting a chosen
  option removes it.
- A malformed `value` such as `[oops` keeps its text and marks the field invalid.
- The committed value for `multiple` is valid JSON that round-trips through `JSON.parse`.
