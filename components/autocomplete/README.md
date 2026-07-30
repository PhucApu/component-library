# Autocomplete

`<ui-autocomplete>` is a framework-free Web Component that filters a list of options as the user
types and commits either one value or many.

## Features

- Single and multiple selection, the second rendered as removable chips.
- Optional free text, so a typed value that matches no option can still be committed.
- Diacritic-insensitive filtering, so an unaccented query finds an accented label.
- Matched text is marked inside each suggestion.
- Grouped options declared with `optgroup`, with headings skipped by keyboard navigation.
- Loading, error, empty, no-results, read-only, and disabled states.
- No runtime dependency and no reliance on catalog CSS or JavaScript.

## Installation

The download contains `autocomplete.html`, `autocomplete.css`, and `autocomplete.js`. Copy the
stylesheet and the script into your project, then load them:

```html
<link rel="stylesheet" href="./autocomplete.css" />
<script type="module" src="./autocomplete.js"></script>
```

`autocomplete.html` is a runnable example of the two tags above. Serve it over HTTP rather than
opening it from disk: browsers block ES modules on `file://`, so the component would never
register.

## Declaring options

`option` and `optgroup` are the source of truth, so a list can be declared in markup:

```html
<ui-autocomplete mode="single" aria-label="Choose an office">
  <optgroup label="Viet Nam">
    <option value="hanoi">Ha Noi</option>
    <option value="danang">Da Nang</option>
  </optgroup>
  <optgroup label="Japan">
    <option value="osaka">Osaka</option>
    <option value="sapporo" disabled>Sapporo</option>
  </optgroup>
</ui-autocomplete>
```

An `option` without a `value` uses its text content, matching how `select` behaves.

For data that arrives later, assign the `options` property instead. It replaces the declared list:

```js
field.options = [
  { value: 'hanoi', label: 'Ha Noi', group: 'Viet Nam' },
  { value: 'osaka', label: 'Osaka', group: 'Japan', disabled: true },
];
```

## Reading and writing the value

```html
<ui-autocomplete mode="multiple" value='["css","accessibility"]'></ui-autocomplete>
```

```js
const field = document.querySelector('ui-autocomplete');

field.addEventListener('autocomplete-change', (event) => {
  field.value = event.detail.value;
  console.log(event.detail.selected);
});
```

The component is controlled-first: an interaction emits `autocomplete-change`, and the consumer
writes the proposed value back to the `value` property or attribute. Nothing is written back
automatically.

## Value contract

| Mode | `value` | Empty |
|---|---|---|
| `single` | The chosen option's value | `""` |
| `multiple` | A JSON array of values, such as `["css","testing"]` | `"[]"` |

A JSON array is used rather than a delimiter so a value may contain any character, including a
comma. A malformed value, or one that matches no option while `free-text` is absent, is preserved
and the field is marked `aria-invalid` instead of being silently discarded.

## API

| Attribute | Type | Default | Purpose |
|---|---|---|---|
| `mode` | `single \| multiple` | `single` | Selects the value contract |
| `value` | `string` | `""` | Controlled value |
| `free-text` | `boolean` | absent | Accepts values outside the option list |
| `disabled` | `boolean` | absent | Blocks all interaction |
| `readonly` | `boolean` | absent | Shows the value without allowing edits |
| `placeholder` | `string` | `""` | Placeholder for the query input |
| `loading` | `boolean` | absent | Shows the loading message in the list |
| `error` | `string` | `""` | Shows an error message in the list |
| `min-chars` | `number` | `0` | Characters required before the list opens |
| `aria-label` | `string` | `""` | Accessible name for the query input |

| Property | Purpose |
|---|---|
| `options` | Array of `{ value, label, group, disabled }`, replacing the declared list |
| `selectedOptions` | Read-only array of the currently selected option objects |
| `labels` | Partial object overriding the English interface strings |

## Keyboard

| Key | Behavior |
|---|---|
| Arrow Down / Up | Opens the list, then moves through available options |
| Home / End | Jumps to the first or last available option |
| Enter | Selects the active option, or commits typed text when `free-text` is set |
| Escape | Closes the list |
| Tab | Closes the list without selecting |
| Backspace | Removes the last chip when the query is empty in `multiple` mode |

## Accessibility

The query input uses `role="combobox"` with `aria-expanded`, `aria-controls`,
`aria-activedescendant`, and `aria-autocomplete="list"`. Suggestions use `role="option"` inside a
`role="listbox"`, and groups use `role="group"` with an accessible name. Group headings are not
reachable by keyboard because they are not options.

Result counts are announced through a screen-reader-only live region and never shown on screen.
Unavailable options carry a strike-through and a screen-reader-only label, so their state is not
signalled by colour alone. Each chip exposes its own remove button with the option name.

## Performance

Every matching option is rendered; there is no virtualization in this version. Lists in the low
hundreds are comfortable. Beyond a few thousand options, filter the data before assigning it to
the `options` property.

## Browser support

The component requires Custom Elements and ES modules, so it has to be served over HTTP or
HTTPS. It uses the native Popover API when available and a fixed-position portal fallback
otherwise. Repository automation covers Chromium.

Version 0.1 does not include virtualization, custom render slots, fuzzy matching, or
form-associated custom elements.
