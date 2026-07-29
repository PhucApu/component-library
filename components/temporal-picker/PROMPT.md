# Recreate Temporal Picker

You are a Senior Frontend Engineer. Build a Web Component named `<temporal-picker>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

## Output

Create a portable component with this structure:

```text
components/temporal-picker/
|-- component.json
|-- README.md
|-- DESIGN.md
|-- PROMPT.md
|-- preview/thumbnail.svg
`-- source/
    |-- demo.js
    |-- shared.css
    |-- shared.js
    |-- temporal-picker-core.js
    `-- variants/
        |-- year/index.html
        |-- month/index.html
        |-- date/index.html
        |-- time/index.html
        |-- datetime/index.html
        `-- bounded-datetime/index.html
```

Use manifest schema version 2, component version `0.3.0`, group `inputs`, and English variant
descriptions. Each entry must run directly in a browser or iframe, display raw output, use
`lang="en"` and `locale="en-US"`, and remain independent from catalog code.

The catalog thumbnail must be a static, self-contained `640x360` SVG. Preserve the approved dark
composition of the open Datetime variant, including the populated trigger, September 2027
calendar, selected day 18, `08:45:30` time controls, Second field, and Apply action. Do not add
animation, script, external assets, or embedded raster images.

## Public API

```html
<temporal-picker
  mode="datetime"
  value="2027-09-18T08:45:30"
  min="2027-01-01T00:00:00"
  max="2027-12-31T23:59:59"
  minute-step="1"
  current-indicator="auto"
  locale="en-US"
  week-starts-on="1"
  placement="auto"
  aria-label="Choose a date and time"
></temporal-picker>
```

Support `mode`, `value`, `disabled`, `min`, `max`, `minute-step`, `current-indicator`, `locale`,
`week-starts-on`, `placement`, `placeholder`, and `aria-label` as attributes or properties.
Reflect `current-indicator` through `currentIndicator`, accept `auto` or `off`, and normalize any
other value to `auto`.
The `labels` property accepts a partial object for consumer localization, including Hour,
Minute, Second, search status, result count, no-results, and unavailable labels.

Commit through:

```js
new CustomEvent('temporal-change', {
  detail: { value, mode },
  bubbles: true,
  composed: true,
});
```

The component is controlled-first: it emits a proposed value but does not write that value back
to `value`. External `value` updates synchronize the draft even while the panel is open.

## Value contract

| Mode | Format |
|---|---|
| `year` | `YYYY` |
| `month` | `YYYY-MM` |
| `date` | `YYYY-MM-DD` |
| `time` | `HH:mm:ss` |
| `datetime` | `YYYY-MM-DDTHH:mm:ss` |

- Accept years `0001-9999`.
- Time and datetime values without seconds are invalid.
- Never add a timezone, `Z`, or offset and never call `toISOString()`.
- Do not normalize civil values with the `Date` constructor.
- Implement pure Gregorian helpers for leap years, month lengths, weekdays, tuple comparison,
  date arithmetic, and a 42-cell calendar grid.
- Use `Date` only to read local now and support display formatting after validation.
- Treat `min` and `max` as inclusive values in the active-mode format.
- Preserve invalid or out-of-range controlled values and mark the trigger `aria-invalid`.
- Block selection and commits when bounds are malformed or `min > max`.
- Normalize `minute-step` to an integer from `1-60`; default to `1` and include an off-step
  controlled minute in the available options.
- Hour and Second always use a step of one. Do not add `second-step`.

## Variants and commit behavior

- `year`: unrestricted twelve-year grid initialized from the system year; commit immediately.
- `month`: unrestricted twelve-month grid initialized from the system month; commit immediately.
- `date`: unrestricted six-by-seven day grid initialized from the system date; commit immediately.
- `time`: unrestricted searchable Hour, Minute, and Second controls; Apply commits `HH:mm:ss`.
- `datetime`: initialize from the current local datetime; Apply commits the unrestricted calendar
  and searchable time-control draft and remains the primary preview.
- `bounded-datetime`: the same UI with inclusive bounds
  `2027-09-10T07:00:00` through `2027-09-24T18:00:00` and
  `current-indicator="off"`.
- Clear emits an empty string and closes.
- Current commits immediately for year, month, and date, but only updates the draft for time and
  datetime modes.

For Bounded Datetime, a date is enabled if any instant on that date intersects the range. An Hour
is enabled if any Minute and Second candidate remains valid. A Minute is enabled if any Second
candidate remains valid. A Second checks the complete candidate. Unavailable options remain
visible in search results but cannot become active or selected.

## Searchable time comboboxes

Render three two-digit inputs in one row, with one shared full-width listbox underneath.

- Use `inputmode="numeric"` and accept ASCII digits only.
- Click, input, or Arrow Down opens the current list. Only one list is open at a time.
- An empty query shows every option. Query `8` must match `08`.
- Arrow Up/Down navigates, Home/End jumps, Enter selects, Escape closes the list first, and Tab
  closes without selecting.
- Skip unavailable options during navigation.
- Use `role="combobox"`, `role="listbox"`, `role="option"`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, `aria-selected`, and `aria-disabled`.
- Include a visible selected check and unavailable text.
- Announce result counts and no-results through a live status.
- Selecting Hour, Minute, or Second updates only the draft. Apply performs the commit.

## Popover, calendar, responsive behavior, and accessibility

Use Light DOM, the `temporal-picker__*` class namespace, and component-owned CSS custom
properties. Prefer the Popover API; otherwise portal the panel to `document.body` and position it
with `position: fixed`.

- Use a non-modal `role="dialog"` with an accessible label.
- Keep `aria-expanded`, `aria-haspopup`, and `aria-controls` on the trigger.
- Support `auto`, `top`, and `bottom` placement, an `8px` gap, and `12px` viewport padding.
- Reposition on resize and relevant scrolling.
- Ignore scroll events originating in the panel or listbox so scrolling never resets
  `scrollTop`.
- Outside click closes without restoring trigger focus.
- Escape, Apply, Clear, and immediate commits restore trigger focus.
- Limit panel width to `calc(100vw - 24px)` and scroll internally when required.
- Keep all three time inputs usable at `320px`; avoid horizontal overflow at `375x667`.
- Render 42 day cells and derive week start from the configured attribute or `Intl.Locale`.
- Use native disabled state, `aria-selected`, `aria-current="date"`, full date labels, and
  roving `tabindex`.
- With `current-indicator="auto"`, ring the current year, current month in its matching year, and
  current date. Add `aria-current` and an English current-value label. Preserve selected fill on
  hover and focus, including when selected and current are the same value. Time mode has no
  current marker.
- Style panel and listbox scrollbars with component-owned light and dark tokens.
- Support the documented day, month, and year grid keyboard interactions.
- Keep live regions for view, validation, and time-search status.
- Remove motion under `prefers-reduced-motion: reduce`.

## Tests and delivery

Write `node:test` coverage for strict formats, seconds `00` and `59`, rejected legacy values,
years `0001`, `0099`, and `9999`, leap dates, Gregorian grids, inclusive second boundaries,
invalid bounds, range comparison, 60 minute options at step one, and absence of timezone output.

Write Playwright coverage for all six variants, time search and filtering, keyboard/ARIA
behavior, one-listbox behavior, draft and Apply timing, external synchronization, unrestricted
calendar variants, current indicators, selected hover/focus styling, functional panel/listbox
scrolling, dynamic bounded options, mobile overflow, reduced motion, document downloads, and ZIP
version `0.3.0`.

Run English validation, component validation, registry generation, preview generation, packaging,
publishing, and the full repository verification flow.
