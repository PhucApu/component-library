# Temporal Picker - Design Specification

## 1. Goal

Temporal Picker provides one portable control for selecting a year, month, date, time, or local
datetime. It prioritizes precise civil-time values, efficient keyboard input, accessible
navigation, and framework-free distribution.

Version `0.3.0` adds seconds and searchable time comboboxes. The five primary examples are
unrestricted. A separate Bounded Datetime variant demonstrates inclusive `min` and `max`
behavior without making unavailable values appear to be a default limitation.

## 2. Visual direction

The direction is **Calm Precision**: neutral surfaces, system typography, clear boundaries, an
indigo accent, and compact hierarchy. The component owns every token it uses. Example pages use
an independent dark palette that visually fits the catalog preview stage.

| Token | Default | Role |
|---|---|---|
| `--temporal-surface` | `#ffffff` | Trigger and panel |
| `--temporal-surface-subtle` | `#f8fafc` | Header and subtle hover |
| `--temporal-text` | `#111827` | Primary text |
| `--temporal-muted` | `#5f6878` | Secondary text |
| `--temporal-border` | `#cbd5e1` | Boundaries |
| `--temporal-accent` | `#4f46e5` | Selection and primary action |
| `--temporal-accent-strong` | `#4338ca` | Hover and active |
| `--temporal-focus` | `#6366f1` | Focus ring |
| `--temporal-danger` | `#b42318` | Invalid configuration or value |
| `--temporal-current` | `#7c3aed` | Current day, month, or year ring |
| `--temporal-scrollbar-track` | `#eef2f7` | Scrollable surface track |
| `--temporal-scrollbar-thumb` | `#94a3b8` | Scroll thumb |
| `--temporal-scrollbar-thumb-hover` | `#64748b` | Hovered scroll thumb |
| `--temporal-radius` | `12px` | Trigger and panel radius |
| `--temporal-shadow` | `0 18px 48px rgb(15 23 42 / 0.18)` | Panel elevation |

Normal text meets WCAG AA `4.5:1`; focus indicators and UI boundaries meet at least `3:1`.

## 3. Anatomy

1. Trigger field with a calendar or clock icon, formatted value or placeholder, and chevron.
2. Non-modal floating dialog with a live region and mode-specific content.
3. Calendar header and day, month, or year grid.
4. Three searchable combobox inputs for Hour, Minute, and Second in time-capable modes.
5. One shared listbox in its own floating layer, anchored under the active time input.
6. Current, Clear, Close, and Apply actions as required by the active mode.
7. Validation message associated with the trigger.

The native Popover API is preferred for both the panel and the time dropdown. The fallback
portals each surface to `document.body` and uses fixed positioning. Panel viewport padding is
`12px` and its trigger gap is `8px`. The dropdown keeps the same viewport padding with a `4px`
input gap.

## 4. Value contract

| Mode | Format |
|---|---|
| `year` | `YYYY` |
| `month` | `YYYY-MM` |
| `date` | `YYYY-MM-DD` |
| `time` | `HH:mm:ss` |
| `datetime` | `YYYY-MM-DDTHH:mm:ss` |

Years are `0001-9999`. Time and datetime values must include seconds. Older values without
seconds are invalid by design. Values are civil strings without a timezone, offset, `Z`, or
normalization through `Date`.

`min` and `max` use the same active-mode format and are inclusive. Invalid bounds or `min > max`
block selection and commit. An out-of-range controlled value remains visible and marks the
trigger invalid.

## 5. Variants

### Year

An unrestricted twelve-year grid initialized from the current system year. Selection commits
immediately and closes the panel.

### Month

An unrestricted twelve-month grid initialized from the current system month, with year
navigation. Selection commits immediately without adding a day.

### Date

An unrestricted six-by-seven Gregorian calendar initialized from the current system date.
Selection commits immediately.

### Time

Searchable Hour, Minute, and Second comboboxes edit a draft `HH:mm:ss` value. Apply commits it.
Hour and Second always use a step of one. Minute uses `minute-step`, which defaults to one.

### Datetime

An unrestricted calendar and the three searchable time comboboxes edit one draft
`YYYY-MM-DDTHH:mm:ss` value. Its demo initializes from the current local datetime. This is the
primary preview variant.

### Bounded Datetime

The datetime anatomy is unchanged, but the example range is
`2027-09-10T07:00:00` through `2027-09-24T18:00:00`. A date is available when any time on that
date intersects the range. An Hour is available when at least one Minute and Second remain
valid; a Minute is available when at least one Second remains valid; a Second evaluates the
complete candidate. This example uses `current-indicator="off"`.

## 6. Searchable time combobox interaction

- The three inputs remain in one row at viewport widths down to `320px`.
- Each input displays two ASCII digits and uses `inputmode="numeric"`.
- Click, text input, or Arrow Down opens the shared listbox. Only one combobox is open.
- An empty query shows every option. A query such as `8` matches `08`.
- Opening a field that already holds a value seeds the query with that value, so the listbox
  opens filtered to it.
- The first Arrow, Home, or End press after a seeded open clears that query, restores the full
  list, and keeps the current value active and scrolled into view. Later presses navigate
  normally, so keyboard browsing is never lost.
- Arrow Up and Arrow Down move through available results. Home and End move to the first or last
  available result. Enter selects the active result.
- Escape closes the listbox first; a second Escape closes the picker. Tab closes the listbox and
  continues normal focus navigation without selecting.
- Pointer activity outside the listbox that is not another time input dismisses the listbox while
  the panel stays open.
- Unavailable options remain visible, use `aria-disabled="true"`, carry a strike-through and a
  screen-reader unavailable label, and never receive active focus.
- Selecting a time option updates only the draft. Time and Datetime commit only with Apply.

Each input uses `role="combobox"`, `aria-expanded`, `aria-controls`,
`aria-activedescendant`, and `aria-autocomplete="list"`. The shared result surface uses
`role="listbox"` and its rows use `role="option"` with `aria-selected`. A screen-reader-only live
status reports the result count or no results; the count is never shown visually. Selected rows
include a visible check mark. The no-results message stays visible inside the dropdown.

## 7. Calendar interaction and accessibility

- The trigger exposes `aria-expanded`, `aria-haspopup="dialog"`, and `aria-controls`.
- Initial panel focus targets the selected value, today, or the first enabled item.
- Day grid: arrows move one day or week; Home/End move to week boundaries; Page Up/Down moves
  one month; Shift + Page Up/Down moves one year; Enter or Space selects.
- Month and year grids: Left/Right moves one cell, Up/Down moves three, Enter or Space selects.
- Roving `tabindex` keeps one grid item in the tab order.
- Day buttons use full date labels, `aria-selected`, and `aria-current="date"`.
- `current-indicator="auto"` is the default. It rings the current year, the current month when
  its year is visible, and the current date. `current-indicator="off"` removes both the ring and
  `aria-current`. Time mode does not render a current marker.
- Current uses a single hairline border in `--temporal-current`. When a cell is both current and
  selected, the accent fill repaints that border, so the marker falls back to one `1px` ring in
  the same token. Selection retains its accent fill on hover and focus, while focus uses a
  separate outline so selected, current, and focused states can coexist.
- External `value` changes synchronize the open draft.
- Outside click closes without moving focus from the clicked target.
- Escape, Apply, Clear, and immediate commits close and restore trigger focus.
- A live region announces view, search results, and validation.

## 8. Responsive behavior and motion

- The panel is at most `22rem` wide and never wider than `calc(100vw - 24px)`.
- At `480px` and below, padding contracts while calendar cells and time inputs remain usable.
- The time dropdown matches the width of the input it is anchored to, has its own vertical scroll
  capped at `168px`, flips above the input when space below is short, and stays inside the
  viewport.
- The panel scrolls internally when taller than the available viewport.
- Listbox scroll events never trigger repositioning or reset `scrollTop`. Panel scroll keeps the
  panel anchored to the trigger and re-anchors the dropdown to its input.
- Component-owned scrollbar tokens provide matching light and dark tracks and thumbs.
- There is no horizontal overflow at `375x667`.
- Opacity and translate transitions take about `140ms`.
- `prefers-reduced-motion: reduce` removes transitions and smooth behavior.

## 9. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the primary Datetime variant in its
open state. It preserves the approved composition and palette while showing `08:45:30` and a
visible Second field. It is self-contained and contains no animation, script, external asset, or
embedded raster image.

Generated `poster.png` and `demo.webm` stay local. They are QA evidence and a build gate that
proves the component renders in a real browser; no page requests them, so publishing leaves them
behind. The interactive Datetime example starts closed so visitors initiate every interaction.

## 10. Acceptance criteria

- All six variants run independently and match the strict value contract.
- The five primary variants contain no range restriction; Bounded Datetime alone demonstrates
  unavailable values.
- Search, keyboard navigation, ARIA relationships, selected state, unavailable state, and draft
  behavior work for Hour, Minute, and Second.
- Year, Month, Date, and Datetime expose current system values on load. Bounded Datetime disables
  current markers, and Time has no calendar marker.
- Panel and listbox scrolling remain functional, and selected dates keep their fill on hover and
  focus.
- Seconds `00` and `59`, inclusive second boundaries, leap dates, and years `0001-9999` remain
  civil values without timezone conversion.
- Focus restoration, outside click, collision handling, responsive behavior, and reduced motion
  match this document.
- README, PROMPT, manifest, thumbnail, tests, and source describe the same API and behavior.
