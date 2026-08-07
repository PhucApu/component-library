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

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--temporal-surface` | `#ffffff` | `#171a20` | Trigger and panel |
| `--temporal-surface-subtle` | `#f8fafc` | `#1d2128` | Header and subtle hover |
| `--temporal-text` | `#111827` | `#f4f6fa` | Primary text |
| `--temporal-muted` | `#5f6878` | `#a8afbc` | Secondary text |
| `--temporal-border` | `#cbd5e1` | `#3b414c` | Boundaries |
| `--temporal-border-strong` | `#94a3b8` | `#5a6272` | Trigger on hover |
| `--temporal-accent` | `#4f46e5` | `#4968e8` | Selection and primary action |
| `--temporal-accent-strong` | `#4338ca` | `#3857d6` | Hover and active |
| `--temporal-on-accent` | `#ffffff` | `#ffffff` | Text on the accent |
| `--temporal-focus` | `#6366f1` | `#86a0ff` | Focus ring |
| `--temporal-danger` | `#b42318` | `#ff8e87` | Invalid configuration or value |
| `--temporal-current` | `#7c3aed` | `#91a8ff` | Current day, month, or year ring |
| `--temporal-scrollbar-track` | `#eef2f7` | `#111318` | Scrollable surface track |
| `--temporal-scrollbar-thumb` | `#94a3b8` | `#4a5260` | Scroll thumb |
| `--temporal-scrollbar-thumb-hover` | `#64748b` | `#697385` | Hovered scroll thumb |
| `--temporal-radius` | `12px` | | Trigger and panel radius |
| `--temporal-shadow` | `0 20px 52px` plus a paired colour | | Panel elevation |

`--temporal-on-accent` does not pair. The accent is a saturated indigo in both themes, so
white holds on it either way: `6.29:1` light, `4.74:1` dark. It exists as a token rather
than as a repeated literal so that the relationship between a fill and what is written on
it stays visible in one place.

`--temporal-shadow` keeps one offset and blur across both themes and pairs only its
colour, because `light-dark()` resolves a colour rather than a whole value.

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

The panel is portalled to the end of the body when the popover API is unavailable, so it
resolves these tokens from the document rather than from an ancestor it no longer has.

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

## 8. Datetime layout: the clock beside the calendar

From `37rem` (`592px`) up, a datetime panel puts its time fields in a second column to the right
of the calendar rather than in a row underneath it. The panel widens from `22rem` to `35rem` and
loses `90px` of height — measured `560x417` against the stacked panel's `352x507`.

**The row stays a row.** Hour, Minute and Second sit across the column exactly as they do in the
time-only picker, colons and all. Only the block moved; the arrangement inside it did not.

The threshold is the content: that row needs about `216px`, the day grid wants about `300px` to
keep its cells at their full `40px`, and the panel's padding and rule take the rest to `560px`.

- **No markup changes for any of it.** `_renderPanel` already writes `data-mode` on the panel, so
  the whole layout is reachable from the stylesheet. DOM order is untouched, which keeps the tab
  order untouched: day grid, then Hour, Minute, Second. Read left to right, that is still the
  order the eye takes.
- The rule between the two blocks turns with them, from a top border to an inline-start border.
- **The time column is a definite `13.5rem` track, not `auto`** — and the one that pays for
  getting that wrong is the calendar, not the clock. The time fields are `inline-size: 100%`, so
  an `auto` track has no natural size to settle on and takes everything the flexible column will
  give up. Measured: `0px 518px`, a panel with no visible calendar at all.
- The calendar declares explicit rows here. Without them the time block's `1 / -1` span resolves
  against an explicit grid of one line, collapses, and claims row one — which pushes the calendar
  down and makes the panel `90px` *taller* than the layout it was meant to improve on.
- Below the threshold **not one of these rules applies**, so the narrow layout is the original
  stacked one rather than a second layout to keep in step.
- Both `datetime` and `bounded-datetime` run in `mode="datetime"` and share the layout. `time`
  mode has no calendar to sit beside and is scoped out of every rule.

## 9. Responsive behavior and motion

- The panel is at most `22rem` wide — `35rem` for datetime above `37rem` — and never wider than
  `calc(100vw - 24px)`.
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

## 10. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the primary Datetime variant in its
open state. It preserves the approved composition and palette while showing `08:45:30` and a
visible Second field. It is self-contained and contains no animation, script, external asset, or
embedded raster image.

Generated `poster.png` and `demo.webm` stay local. They are QA evidence and a build gate that
proves the component renders in a real browser; no page requests them, so publishing leaves them
behind. The interactive Datetime example starts closed so visitors initiate every interaction.

## 11. Acceptance criteria

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
- Above `37rem` a datetime panel places its time fields beside the calendar as a row, top-aligned
  with the month heading, with the rule running the calendar's height, the day cells still at
  `40px`, and the dropdown clearing the day grid entirely. Below that width the stacked layout is
  unchanged, and `time` mode is unchanged at every width.
- README, PROMPT, manifest, thumbnail, tests, and source describe the same API and behavior.
