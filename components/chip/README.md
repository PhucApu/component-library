# Chip

`<ui-chip>` styles a compact token. It does not decide what the token is: you write the element
that matches the behavior, and the chip supplies the shell.

## Why the markup is yours

A chip is not one control. A label, a button, a link, and a toggle look alike in this shape but
behave differently, and only the right element gives the right keyboard handling, the right role,
and the right announcement. Handing that choice to an attribute is how chips end up as buttons
pretending to be text.

```html
<ui-chip><span>Design</span></ui-chip>                             <!-- a label -->
<ui-chip><button type="button">Add label</button></ui-chip>        <!-- an action -->
<ui-chip><a href="/tags/design">Design</a></ui-chip>               <!-- a link -->
<ui-chip><button aria-pressed="false">Open</button></ui-chip>      <!-- a toggle -->
<ui-chip removable><span>Ha Linh</span></ui-chip>                  <!-- a token -->
```

## Installation

The download contains `chip.html`, `chip.css`, and `chip.js`. Copy the stylesheet and the script
into your project, then load them:

```html
<link rel="stylesheet" href="./chip.css" />
<script type="module" src="./chip.js"></script>
```

`chip.html` is a runnable example. Serve it over HTTP rather than opening it from disk: browsers
block ES modules on `file://`, so the script would never register.

## Removing

Add `removable` and the chip appends its own remove button, named after the chip's text:

```html
<ui-chip removable><span>Ha Linh</span></ui-chip>
```

```js
document.addEventListener('chip-remove', (event) => {
  event.target.closest('ui-chip').remove();
});
```

The chip reports the request and leaves the decision to you; it never removes itself. Backspace or
Delete does the same while focus is inside the chip.

The remove button is appended **beside** your element, never inside it. A button nested in a
button or a link is invalid markup that assistive technology handles unpredictably, so a chip that
both acts and removes is two adjacent controls with two tab stops.

## Toggling

Write a button with `aria-pressed` and the chip keeps the attribute, the `selected` state, and the
styling in step:

```js
document.addEventListener('chip-toggle', (event) => {
  console.log(event.detail.selected);
});
```

## API

| Attribute | Type | Default | Purpose |
|---|---|---|---|
| `appearance` | `filled \| outlined` | `filled` | Surface treatment |
| `intent` | `neutral \| accent \| success \| warning \| danger` | `neutral` | Meaning conveyed |
| `size` | `md \| sm` | `md` | Chip size |
| `removable` | `boolean` | absent | Appends the remove button |
| `selected` | `boolean` | absent | Toggle state, mirrored to `aria-pressed` |
| `disabled` | `boolean` | absent | Blocks activation and removal |

| Event | Detail |
|---|---|
| `chip-remove` | `{ label }` |
| `chip-toggle` | `{ selected, label }` |

| Property | Purpose |
|---|---|
| `control` | The element you wrote inside the chip |
| `label` | The chip's text, whitespace collapsed |
| `labels` | Partial object overriding the English interface strings |

## Disabling a link chip

`disabled` is not a real attribute on `<a>`. A browser ignores it, so a link chip that merely
looked disabled would still navigate. When the chip is disabled it removes `href` from the anchor,
which also takes it out of the tab order, adds `aria-disabled`, and blocks activation. The original
`href` is restored when the chip is enabled again.

Buttons take the native `disabled` attribute and need none of that.

## Accessibility

- A static chip is not focusable. Making a plain label a tab stop asks keyboard users to visit
  something they cannot act on, which is why this differs from some other libraries.
- The remove button's name always includes the chip's text, so a list of chips does not become a
  row of identical "Remove" buttons.
- Toggle chips use `aria-pressed`, not `aria-selected`, because `aria-selected` requires a
  listbox, grid, or tab context that a loose row of chips does not provide.
- Selection shows a check alongside the surface change, and disabled shows dimming with a blocked
  cursor, so neither state depends on colour alone.
- Every intent was checked against the label colour for contrast at both appearances.

## Browser support

Custom Elements and ES modules are needed, so serve over HTTP or HTTPS. Repository automation
covers Chromium.

Version 0.1 does not include chip groups with roving focus, custom delete icons, or multiline
labels.
