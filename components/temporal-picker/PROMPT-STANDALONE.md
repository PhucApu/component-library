# Recreate Temporal Picker as three files

You are a Senior Frontend Engineer. Build a Web Component named `<temporal-picker>` using plain
HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI framework, a
backend, or a new dependency.

This prompt targets the distributable form: three files a consumer drops into a project. It is
self-contained and assumes no repository, build step, manifest, or test harness.

## Output

Produce exactly these files, flat, with no subdirectories:

```text
temporal-picker.html
temporal-picker.css
temporal-picker.js
README.md
```

- `temporal-picker.js` is one ES module holding the whole component: Gregorian helpers, the
  custom element, and the demo bootstrap. It defines the element only when it is not already
  registered.
- `temporal-picker.css` holds every style, namespaced under `temporal-picker__*`, driven by
  component-owned CSS custom properties.
- `temporal-picker.html` is a runnable example that loads the other two with
  `<link rel="stylesheet" href="./temporal-picker.css">` and
  `<script type="module" src="./temporal-picker.js">`, shows one picker in `datetime` mode, and
  prints the committed value into an `<output>` element.
- `README.md` documents installation, the attribute table, the value contract, and browser
  support.

Use `lang="en"` and `locale="en-US"`. ES modules do not load from `file://`, so state in the
README that the page must be served over HTTP or HTTPS.

Add a comment beside the `<temporal-picker>` tag in the demo listing the selectable modes and a
bounded example, so a reader discovers the other configurations without opening the README.

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
other value to `auto`. The `labels` property accepts a partial object for consumer localization,
including Hour, Minute, Second, search status, result count, no-results, and unavailable labels.

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

## Modes and commit behavior

One element serves every mode; the mode is configuration, not a separate build.

- `year`: unrestricted twelve-year grid initialized from the system year; commit immediately.
- `month`: unrestricted twelve-month grid initialized from the system month; commit immediately.
- `date`: unrestricted six-by-seven day grid initialized from the system date; commit immediately.
- `time`: unrestricted searchable Hour, Minute, and Second controls; Apply commits `HH:mm:ss`.
- `datetime`: initialize from the current local datetime; Apply commits the calendar and
  searchable time-control draft.
- Setting `min` and `max` on `datetime` produces the bounded behavior; pair it with
  `current-indicator="off"` when the current date should not be marked.
- Clear emits an empty string and closes.
- Current commits immediately for year, month, and date, but only updates the draft for time and
  datetime modes.

With bounds, a date is enabled if any instant on that date intersects the range. An Hour is
enabled if any Minute and Second candidate remains valid. A Minute is enabled if any Second
candidate remains valid. A Second checks the complete candidate. Unavailable options remain
visible in search results but cannot become active or selected.

## Searchable time comboboxes

Render three two-digit inputs in one row. One shared listbox serves all three, and it renders in
its own floating layer anchored under the input that owns it, matched to that input's width. It
must not live inside the panel: the panel scrolls its own overflow and would clip it.

- Use `inputmode="numeric"` and accept ASCII digits only.
- Click, input, or Arrow Down opens the current list. Only one list is open at a time.
- Opening a field that already holds a selectable value seeds the query with that value, so the
  list opens filtered to it. Seed only when the value is still selectable: seeding an out-of-range
  value would show a single disabled row and hide every option the user can actually pick.
- The first Arrow, Home, or End press after a seeded open clears that query, restores the full
  list, and keeps the current value active and scrolled into view. Later presses navigate
  normally, so keyboard browsing is never lost.
- An empty query shows every option. Query `8` must match `08`.
- Arrow Up/Down navigates, Home/End jumps, Enter selects, Escape closes the list first, and Tab
  closes without selecting.
- Pointer activity outside the list that is not another time input dismisses the list while the
  panel stays open. Clicking another time input hands the list straight over to it.
- Skip unavailable options during navigation.
- Place the list `4px` below its input, keep the same `12px` viewport padding as the panel, cap
  its scroll height around `168px`, and flip it above the input only when the space below cannot
  hold a usable list. Flipping merely because the preferred height does not fit would cover the
  calendar for no gain.
- Use `role="combobox"`, `role="listbox"`, `role="option"`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, `aria-selected`, and `aria-disabled`.
- Show a visible check on the selected row. Mark unavailable rows with a strike-through and a
  screen-reader-only unavailable label; the wording is never shown visually.
- Report result counts and no-results through a screen-reader-only live status. The count is
  never shown visually. The no-results message stays visible inside the list.
- Selecting Hour, Minute, or Second updates only the draft. Apply performs the commit.

## Popover, calendar, responsive behavior, and accessibility

Use Light DOM, the `temporal-picker__*` class namespace, and component-owned CSS custom
properties. Prefer the Popover API; otherwise portal the panel to `document.body` and position it
with `position: fixed`.

- Use a non-modal `role="dialog"` with an accessible label.
- Keep `aria-expanded`, `aria-haspopup`, and `aria-controls` on the trigger.
- Support `auto`, `top`, and `bottom` placement, an `8px` gap, and `12px` viewport padding.
- Reposition on resize and relevant scrolling.
- Scrolling inside the listbox moves neither surface. Scrolling the panel keeps the panel
  anchored to the trigger and re-anchors the listbox to its input. Neither ever resets
  `scrollTop`.
- Outside click closes without restoring trigger focus.
- Escape, Apply, Clear, and immediate commits restore trigger focus.
- Limit panel width to `calc(100vw - 24px)` and scroll internally when required.
- Keep all three time inputs usable at `320px`; avoid horizontal overflow at `375x667`.
- **Given the room, move the datetime time fields beside the calendar rather than under it.**
  From about `37rem` widen the panel from `22rem` to `35rem`, move the Hour, Minute and Second
  row into a column on the right, top-aligned with the month heading, and turn the dividing rule
  from a top border into an inline-start one running the calendar's height. The panel gets `90px`
  shorter, which is the reason to do it. Move the row; do not rearrange it — the three fields
  stay across with their colons, exactly as in the time-only picker. Reach it from CSS alone: the
  panel already carries its mode as a data attribute, and leaving the markup alone leaves the tab
  order alone. Give the time column a definite track, or the full-width fields inside it take
  everything the flexible column gives up and the *calendar* is what disappears. Declare the
  calendar's rows explicitly, or the span collapses and the panel comes out *taller*. Assert the
  day grid's width and not just its cell size — a cell keeps its size while overflowing a
  collapsed track. Write it mobile-first so the narrow layout is the original rather than a
  second one to maintain.
- Render 42 day cells and derive week start from the configured attribute or `Intl.Locale`.
- Use native disabled state, `aria-selected`, `aria-current="date"`, full date labels, and
  roving `tabindex`.
- With `current-indicator="auto"`, mark the current year, current month in its matching year, and
  current date with a single hairline border in the current-value token. Selection repaints that
  border, so when a cell is both current and selected fall back to one `1px` ring in the same
  token. Never stack a border and a ring into a double outline. Add `aria-current` and an English
  current-value label. Preserve selected fill on hover and focus, including when selected and
  current are the same value. Time mode has no current marker.
- Style panel and listbox scrollbars with component-owned light and dark tokens.
- Support the documented day, month, and year grid keyboard interactions.
- Keep live regions for view, validation, and time-search status.
- Remove motion under `prefers-reduced-motion: reduce`.

## Verify before delivering

Serve the folder over HTTP and check each item by hand. Every one of these has already regressed
once in a previous build.

- Each of the five modes works by changing only the `mode` attribute, and a bounded `datetime`
  disables the dates, hours, minutes, and seconds outside the range.
- The listbox width matches the input it is anchored to, and it is not clipped by the panel.
- Opening a field with a selectable value shows only that value; the first Home or End press
  restores the full list and holds that value; the next press navigates.
- Opening a field whose value is out of range shows the full list instead of one disabled row.
- Clicking a calendar day dismisses the listbox while the panel stays open.
- Escape closes the listbox, and a second Escape closes the picker with focus back on the
  trigger. Press them in immediate succession: a re-render that restores focus a frame late lets
  the second Escape escape the panel entirely.
- A day that is both today and selected still shows the current marker, and it is one line rather
  than a double outline.
- The committed value never carries a timezone, `Z`, or offset.
