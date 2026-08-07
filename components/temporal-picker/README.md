# Temporal Picker

`<temporal-picker>` is a framework-free Web Component for selecting a civil year, month, date,
time, or local datetime. Values remain local strings: the component never adds a timezone,
UTC offset, or `Z`.

## Features

- Five modes: `year`, `month`, `date`, `time`, and `datetime`.
- Six examples: five unrestricted variants plus a dedicated Bounded Datetime variant.
- Searchable Hour, Minute, and Second comboboxes with one shared listbox.
- Time and Datetime values always include seconds and commit only through Apply.
- Inclusive `min` and `max`, minute steps, locale formatting, and configurable week start.
- Optional current day, month, and year indicators that coexist with selection and focus.
- Keyboard grids, combobox navigation, focus restoration, collision handling, and reduced motion.
- No runtime dependency and no reliance on catalog CSS or JavaScript.

## Installation

The download contains `temporal-picker.html`, `temporal-picker.css`, and
`temporal-picker.js`. Copy the stylesheet and the script into your project, then load them:

```html
<link rel="stylesheet" href="./temporal-picker.css" />
<script type="module" src="./temporal-picker.js"></script>
```

`temporal-picker.html` is a runnable example of the two tags above. Serve it over HTTP rather
than opening it from disk: browsers block ES modules on `file://`, so the component would never
register.

Use the component:

```html
<temporal-picker
  mode="datetime"
  value="2027-09-18T08:45:30"
  minute-step="1"
  locale="en-US"
  week-starts-on="1"
  placement="auto"
  aria-label="Choose a date and time"
></temporal-picker>

<script type="module">
  const picker = document.querySelector('temporal-picker');

  picker.addEventListener('temporal-change', (event) => {
    picker.value = event.detail.value;
    console.log(event.detail);
  });
</script>
```

The component is controlled-first: an interaction emits `temporal-change`, and the consumer
writes the proposed value back to the `value` property or attribute.

## Value contract

| Mode | Format | Example |
|---|---|---|
| `year` | `YYYY` | `2027` |
| `month` | `YYYY-MM` | `2027-09` |
| `date` | `YYYY-MM-DD` | `2027-09-18` |
| `time` | `HH:mm:ss` | `08:45:30` |
| `datetime` | `YYYY-MM-DDTHH:mm:ss` | `2027-09-18T08:45:30` |

- Years are valid from `0001` through `9999`.
- Time and datetime strings without seconds are invalid.
- `min` and `max` use the active mode format and are inclusive.
- Values are never normalized through a timezone.
- Invalid or out-of-range controlled values remain visible and set `aria-invalid="true"`.
- Invalid bounds or `min > max` block selection and commit.

## Searchable time controls

Hour, Minute, and Second are two-digit combobox inputs. Click or type to open the shared listbox.
An empty query shows all values, and a query such as `8` matches `08`.

- Arrow Up/Down navigates available results.
- Home/End moves to the first or last available result.
- Enter selects the active result.
- Escape closes the list before it closes the picker.
- Tab closes the list and continues focus navigation without selecting.
- A selected option includes a check. Unavailable options remain visible and labeled.

Hour and Second always use a step of one. `minute-step` defaults to one and accepts integers from
`1` through `60`. An off-step controlled minute remains available.

## Where the clock sits in datetime mode

Given `37rem` (`592px`) of viewport, a datetime panel moves its time fields to the right of the
calendar instead of underneath it. The panel goes from `352x507` to `560x417` — wider, and `90px`
shorter, which is the point of the arrangement.

Hour, Minute and Second stay in a **row**, colons and all, exactly as in the time-only picker.
Only the block moved; the arrangement inside it did not.

Below that width nothing changes at all: the fields sit in their row under the calendar. The two
layouts are one stylesheet block apart, so the narrow one is the original rather than a second
layout to keep in step.

Widening the panel does not come out of the calendar — the day cells keep their full `40px`.

Tab order does not change with the layout — the markup is identical, and only the boxes move.
`datetime` and `bounded-datetime` share this behavior; `time` mode has no calendar to sit beside
and is unaffected.

## API

| Attribute/property | Type | Default | Purpose |
|---|---|---|---|
| `mode` | `year \| month \| date \| time \| datetime` | `date` | Selects the value contract |
| `value` | `string` | `""` | Controlled civil-time value |
| `disabled` | `boolean` | `false` | Disables the trigger |
| `min`, `max` | `string` | `""` | Inclusive range |
| `minute-step` | `number` | `1` | Minute interval, normalized to `1-60` |
| `current-indicator` | `auto \| off` | `auto` | Shows or suppresses current calendar markers |
| `locale` | `string` | document/browser locale | Display formatting locale |
| `week-starts-on` | `0-6` | locale derived | `0` is Sunday and `1` is Monday |
| `placement` | `auto \| top \| bottom` | `auto` | Preferred panel placement |
| `placeholder` | `string` | mode label | Trigger placeholder |
| `aria-label` | `string` | mode label | Trigger accessible name |

The `labels` property accepts partial English label overrides:

```js
picker.labels = {
  apply: 'Confirm',
  clear: 'Reset',
  hour: 'Hours',
  minute: 'Minutes',
  second: 'Seconds',
  noTimeResults: 'No match',
};
```

`temporal-change` bubbles and crosses a shadow boundary:

```js
picker.addEventListener('temporal-change', (event) => {
  const { value, mode } = event.detail;
});
```

Clear emits an empty string.

`currentIndicator` reflects `current-indicator`. Invalid values normalize to `auto`. Year,
Month, Date, and Datetime expose a ring plus `aria-current` when the relevant system value is
visible. Time has no calendar marker.

## Bounded example

The five primary examples are unrestricted. `bounded-datetime` demonstrates:

```html
<temporal-picker
  mode="datetime"
  value="2027-09-18T08:45:30"
  min="2027-09-10T07:00:00"
  max="2027-09-24T18:00:00"
  current-indicator="off"
></temporal-picker>
```

Dates and time options remain available whenever at least one complete value inside the inclusive
range can be formed.

## Styling

Override component-owned CSS custom properties on the host:

```css
temporal-picker {
  --temporal-accent: #0f766e;
  --temporal-focus: #14b8a6;
  --temporal-current: #2dd4bf;
  --temporal-scrollbar-thumb: #64748b;
  --temporal-radius: 10px;
}
```

The source uses the `temporal-picker__*` namespace and does not import catalog tokens.

## Light and dark

Every colour is a `light-dark()` pair, and `:root` declares `color-scheme: light dark`.
Dropped into a page as-is, the picker follows the operating system. To pin it, narrow the
`color-scheme` of any ancestor:

```css
:root {
  color-scheme: light;
}
```

The panel is portalled out of the picker when the Popover API is unavailable, and it reads
its colours from the document, so it stays on the right side of the theme either way.

The example page also answers a frame that posts
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, which is how a host showing it in an
iframe keeps it in step. Nothing is sent back, and a page that never receives the message
keeps following the system.

## Browser support

The component requires Custom Elements and ES modules, so it has to be served over HTTP or
HTTPS. It uses the native Popover API when available and a fixed-position portal fallback
otherwise. Colours use `light-dark()`. Repository automation covers Chromium.

Version 0.3 does not include form-associated custom elements, range pickers, timezones,
configurable second steps, searchable calendar grids, or presets.
