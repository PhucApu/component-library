# Text Field

`<ui-text-field>` frames a native text input. It does not replace it, so typing, selection, input
methods, autofill, undo, form submission, the right mobile keyboard, and constraint validation all
keep working exactly as the browser implements them.

## Features

- Outlined and filled surfaces at two sizes.
- A static label above the field, wired to the input.
- Hint and error text linked through `aria-describedby`.
- Errors that wait until the person has left the field or submitted.
- Prefix, suffix, and a password reveal button inside the frame.
- Multiline support with a character counter that does not read itself out on every keystroke.
- Read-only and disabled states, which differ in whether the value is submitted.

## Installation

The download contains `text-field.html`, `text-field.css`, and `text-field.js`. Copy the
stylesheet and the script into your project, then load them:

```html
<link rel="stylesheet" href="./text-field.css" />
<script type="module" src="./text-field.js"></script>
```

`text-field.html` is a runnable example. Serve it over HTTP rather than opening it from disk:
browsers block ES modules on `file://`, so the script would never register. The inputs themselves
would still work.

## Markup

```html
<ui-text-field>
  <label for="email">Email</label>
  <div class="text-field__control">
    <input id="email" name="email" type="email" required />
  </div>
  <p class="text-field__hint">We only use this to send receipts.</p>
</ui-text-field>
```

`.text-field__control` is the visible frame; the label sits above it and the hint below. The
element fills in a missing `for` or `id` as a safety net, but write them: the pairing has to exist
before any script runs.

Use `for` and `id` rather than wrapping the input in the label. A wrapping label also captures
clicks on the reveal button, which would toggle the password instead of focusing the field.

## Validation

Native constraint validation does the work. `required`, `type`, `pattern`, `minlength`, and
`maxlength` all apply, and the browser supplies a message already translated into the user's
language.

```html
<input id="email" type="email" required />
```

An error appears only after the person leaves the field or a submit is attempted. An empty
required field is invalid from the moment it renders, so reacting to validity alone would paint a
whole form red before anyone typed anything.

Set `error` when only you know the rule behind a `pattern`:

```html
<ui-text-field error="Use four to sixteen lowercase letters or digits.">
```

## Events

There is no `text-field-change` event. `input` and `change` come from the native control and
already bubble, so adding a third would only invite handling the same edit twice.

`text-field-validity` fires when the field reports its validity after a blur, carrying
`{ valid, message }`.

## API

| Attribute | Type | Default | Purpose |
|---|---|---|---|
| `appearance` | `outlined \| filled` | `outlined` | Surface treatment |
| `size` | `md \| sm` | `md` | Field height and padding |
| `error` | `string` | `""` | Message that replaces the browser's |
| `counter` | `boolean` | absent | Shows a counter when the control has `maxlength` |
| `reveal` | `boolean` | absent | Adds the password reveal button |

| Property | Purpose |
|---|---|
| `value` | Reads and writes the control's value |
| `valid` | Current validity |
| `validationMessage` | The message that would be shown |
| `control` | The `input` or `textarea` you wrote |
| `labels` | Partial object overriding the English interface strings |

| Method | Purpose |
|---|---|
| `validate()` | Forces the error into view and returns validity, for use on submit |
| `reset()` | Clears the interacted state so the field goes quiet again |

## Read-only is not disabled

Both stop editing, and they differ where it matters: a read-only field is still focusable, still
selectable, and **is still submitted with the form**. A disabled field is skipped by the keyboard
and left out of the submission entirely.

Unlike a radio group, where the browser ignores `readonly` altogether, both attributes are real
here and mean different things. Pick the one that matches whether the server should receive the
value.

## Accessibility

- The label is a real `<label for>`, not an `aria-label`, so clicking it focuses the field.
- Hint and error are both referenced by `aria-describedby`; the error is added and removed as it
  applies.
- `aria-invalid` is set only once the person has interacted, matching what is on screen.
- The character counter is `aria-hidden`. A live counter would announce a number after every
  keystroke and bury everything else; a separate polite region speaks only as the limit
  approaches.
- The reveal button's name states the action it will perform next, so it changes between "Show
  password" and "Hide password".
- The frame owns the focus ring, so exactly one indicator appears.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the field follows the operating system. To pin it, narrow the
`color-scheme` of any ancestor:

```css
:root {
  color-scheme: light;
}
```

The example page also answers a frame that posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, which is how a host showing it in an
iframe keeps it in step. Nothing is sent back, and a page that never receives the message
keeps following the system.

## Browser support

Custom Elements and ES modules are needed for the value API and the error wiring, so serve over
HTTP or HTTPS. Styling relies on `:focus-within` and `light-dark()`. Repository automation
covers Chromium.

Version 0.1 does not include a select mode, floating labels, auto-growing textareas, or
form-associated custom elements.
