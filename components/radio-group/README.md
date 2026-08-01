# Radio Group

`<ui-radio-group>` styles native radio inputs and reports the chosen value. It does not replace
the radios, so the browser keeps doing the work it already does well.

## Features

- Single selection, arrow-key movement, roving focus, and form submission handled natively.
- Vertical or row layout, with the row wrapping when space runs out.
- Optional supporting text under each label.
- A card appearance where the whole surface is the target rather than only the dot.
- Error state tied to the fieldset through `aria-describedby`.
- Individually unavailable options and whole-group disabling.
- Works with no JavaScript at all: the group is still a working radio group.

## Installation

The download contains `radio-group.html`, `radio-group.css`, and `radio-group.js`. Copy the
stylesheet and the script into your project, then load them:

```html
<link rel="stylesheet" href="./radio-group.css" />
<script type="module" src="./radio-group.js"></script>
```

`radio-group.html` is a runnable example. Serve it over HTTP rather than opening it from disk:
browsers block ES modules on `file://`, so the script would never register. The radios themselves
would still work.

## Markup

Write the group as ordinary HTML. The element enhances what you write and never rewrites it:

```html
<ui-radio-group name="plan" value="pro" layout="row" appearance="card">
  <fieldset>
    <legend>Choose a plan</legend>
    <div class="radio-group__options">
      <label>
        <input type="radio" name="plan" value="free" />
        <span class="radio-group__text">
          Free
          <small>One project and community support.</small>
        </span>
      </label>
      <label>
        <input type="radio" name="plan" value="pro" />
        <span class="radio-group__text">Pro</span>
      </label>
    </div>
  </fieldset>
</ui-radio-group>
```

`fieldset` and `legend` give the group its accessible name. The `radio-group__options` wrapper is
the layout container.

**Put `name` on every input.** A shared `name` is what makes the browser treat the radios as one
group, and it has to be in the markup for that to hold before any script runs. The element fills
in a missing `name` as a safety net, but a group relying on that is not a group until the script
executes.

## Reading and writing the value

```js
const group = document.querySelector('ui-radio-group');

group.addEventListener('radio-group-change', (event) => {
  console.log(event.detail.value);
});

group.value = 'team';
```

## Value contract

`value` is the value of the chosen radio, or `""` when nothing is chosen. A value matching no
option is kept and the group is marked invalid rather than being reset to blank.

This component follows the platform rather than the controlled-first pattern used by Temporal
Picker and Autocomplete. A click checks the radio immediately, because that is what the browser
does and undoing it would fight the very behavior this component is built on. `radio-group-change`
reports the result; assign `value` inside the handler if you need to override the choice.

## API

| Attribute | Type | Default | Purpose |
|---|---|---|---|
| `name` | `string` | generated | Shared name that groups the radios |
| `value` | `string` | `""` | Chosen value |
| `layout` | `stack \| row` | `stack` | Vertical list or wrapping row |
| `appearance` | `control \| card` | `control` | Plain control or selectable card |
| `size` | `md \| sm` | `md` | Control size |
| `disabled` | `boolean` | absent | Disables every option in the group |
| `error` | `string` | `""` | Message shown and linked to the fieldset |

| Property | Purpose |
|---|---|
| `options` | Read-only model of the radios: value, label, and disabled |
| `checkedValue` | Read-only value currently checked in the DOM |
| `select(value)` | Chooses a value, returning `false` when it is missing or disabled |

## There is no `readonly`

HTML ignores `readonly` on radio and checkbox inputs; it applies only to fields you type into.
Rather than fake it with an attribute that quietly does nothing, this component offers `disabled`.
If you need a value shown but not changeable while still submitting it, pair a disabled group with
a hidden input.

## Accessibility

The group is a `fieldset` with a `legend`, which is what gives assistive technology the group name.
Each option is labelled by its own `label`. The error message carries `role="alert"` and is linked
with `aria-describedby`.

Keyboard behavior is the browser's: arrow keys move between options, and disabled options are
skipped. The focus ring sits on the input itself, so there is exactly one focus indicator.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the group follows the operating system. To pin it, narrow the
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

Custom Elements and ES modules are needed for the value API, so serve over HTTP or HTTPS. The
styling uses `appearance: none` on the input and `light-dark()` for colour. Repository
automation covers Chromium.

Version 0.1 does not include indeterminate states, custom icons, or form-associated custom
elements.
