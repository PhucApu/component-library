# Recreate Text Field

You are a Senior Frontend Engineer. Build a Web Component named `<ui-text-field>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

## The central instruction

`input` and `textarea` already provide typing, selection, input methods, autofill, undo, form
submission, the correct mobile keyboard through `type` and `inputmode`, spellcheck, and constraint
validation. Frame them; do not replace them. The element never rewrites its own markup.

## What to show

Demonstrate these six arrangements. One implementation serves all of them; an arrangement is
configuration, not a separate build.

- **Default**: a plain outlined field with a label and a hint.
- **Filled**: the same field on a filled surface with an underline instead of a full border.
- **Validation**: a required field and a `pattern` field, both quiet until the person interacts.
- **Adorned**: a prefix, a suffix, and a password field with a reveal button.
- **Multiline**: a `textarea` with a character counter, beside one with no limit.
- **Restricted**: a read-only field next to a disabled one, inside a form that reports what it
  would send.

Each has to run on its own, loading nothing from another origin.

## Markup contract

```html
<ui-text-field>
  <label for="email">Email</label>
  <div class="text-field__control">
    <input id="email" name="email" type="email" required />
  </div>
  <p class="text-field__hint">We only use this to send receipts.</p>
</ui-text-field>
```

- `.text-field__control` is the visible frame and holds the input plus any adornments.
- Write `for` and `id`. Fill in a missing pair as a safety net, but the association has to exist
  before any script runs.
- Use `for` and `id` rather than wrapping the input in the label. A wrapping label also captures
  clicks on the reveal button, which would toggle the password instead of focusing the field.

## Public API

Support `appearance` (`outlined` or `filled`), `size` (`md` or `sm`), `error`, `counter`, and
`reveal` as attributes. Expose `value`, `valid`, `validationMessage`, `control`, and `labels`,
plus `validate()` and `reset()`.

**Add no `text-field-change` event.** The native control already emits `input` and `change`, and
both bubble past the host; a third event would give consumers two ways to hear the same edit and
an easy way to handle it twice. Emit only:

```js
new CustomEvent('text-field-validity', {
  detail: { valid, message },
  bubbles: true,
  composed: true,
});
```

## Validation

Use native constraint validation. `required`, `type`, `pattern`, `minlength`, and `maxlength` all
apply, and the browser's message is already translated into the user's language, so it is the
better default. An author-supplied `error` wins, because only the author knows the rule behind a
`pattern`.

**An error must not appear before the person interacts.** An empty required field is invalid from
the moment it renders, so reacting to validity alone paints a whole form red before anyone types.
Use `:user-invalid` for the visual state and set `aria-invalid` on the same terms, so the
announcement matches the screen. Mark the field interacted on blur and on the native `invalid`
event, and let `validate()` force the state for a submit handler.

## Presentation and accessibility

- Put a static label above the field. Do not use a floating label: it reads as a value already
  entered, truncates on narrow screens, and breaks up when text is enlarged.
- Give the frame the focus ring and suppress the input's own outline. A text input matches
  `:focus-visible` even on a mouse click and would stack a second outline inside a surface already
  showing focus.
- Guard the hover rule with `:not(:focus-within)`. Without it hover is the more specific selector,
  so a clicked field keeps its hover colour while the pointer rests on it.
- Reference the hint and the error from `aria-describedby`, adding and removing the error as it
  applies. Create the error element once and reuse it; recreating it breaks the reference.
- **Keep the character counter out of any live region.** A live counter announces a number after
  every keystroke and buries the content being written. Mark the visible counter `aria-hidden` and
  use a separate polite region that speaks only as the limit approaches, and only when the message
  changes.
- Name the reveal button for the action it performs next, alternating between "Show password" and
  "Hide password". Redraw its icon only when the state changes: rewriting the markup on every sync
  destroys the path the pointer pressed down on, and a click whose mousedown target no longer
  exists never reaches the button, so every second press is swallowed.
- Read validity with `validity.valid`, never `checkValidity()`, inside anything that runs while
  handling an `invalid` event. `checkValidity()` fires that event, so the pair recurses until the
  stack gives out.
- Treat a decorative adornment as decorative and a meaningful one as content: a currency symbol is
  hidden, a unit is read.
- Limit transitions to border and shadow at `140ms` and remove them under
  `prefers-reduced-motion: reduce`.
- Define every CSS custom property the component reads inside the component itself, and
  reference nothing outside it. That is what lets the field be lifted into another project
  unchanged.

## Read-only against disabled

Both stop editing and differ in submission: a read-only field is focusable, selectable, and
submitted; a disabled field is skipped by the keyboard and left out of the form data. Both
attributes are real on a text input, so document which one to reach for.

## Verify before calling it done

Keep the rules that decide things — normalising an attribute, choosing between the author's
message and the browser's, deciding whether an error may be shown yet, working out the counter
state — reachable without a browser, so they can be tested on their own.

Check these explicitly, because each is a place this component quietly goes wrong:

- A required field is not marked invalid on load, and becomes invalid only after blur or submit.
- The counter element is not inside a live region.
- A read-only value appears in `FormData` and a disabled one does not.
- With scripting disabled the fields still accept text and the form still submits.
- Exactly one focus indicator is visible when the field has focus.
