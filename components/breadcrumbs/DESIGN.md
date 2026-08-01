# Breadcrumbs - Design Specification

## 1. Purpose

Say where the person is in a hierarchy, and give them one press back to any level above.

## 2. Enhance, do not replace

`nav` carries the landmark, `ol` carries the ordering, and the links already navigate. The
trail is fully usable with no script; the element adds the sizing hooks and the one thing
CSS cannot do, which is putting the middle of a long path behind a button.

This is the same decision as Radio Group, Text Field, and Switch.

## 3. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog.

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--breadcrumbs-separator` | `"/"` | | The divider glyph |
| `--breadcrumbs-link` | `#3b4657` | `#c2cad8` | Levels above the current one |
| `--breadcrumbs-link-hover` | `#111827` | `#ffffff` | Hovered level |
| `--breadcrumbs-current` | `#111827` | `#f4f6fa` | The current page |
| `--breadcrumbs-divider` | `#7c8699` | `#6f7889` | The divider colour |
| `--breadcrumbs-hover-surface` | `#eef1f6` | `#232833` | Hover background |
| `--breadcrumbs-focus` | `#6366f1` | `#86a0ff` | Focus ring |

The divider carries two jobs at once. As the glyph between levels it is decorative, but it
also draws the expand button's edge, which is a user interface boundary and owes `3:1`.
The light half is therefore darker than a hairline separator would need: `#7c8699` reaches
`3.45:1` where the earlier `#98a2b3` reached `2.43:1`.

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.

## 4. The divider is never read aloud

A trail announced as "Home slash Library slash Reports" buries the words that matter. The
divider is therefore generated content with an empty alternative text:

```css
content: var(--breadcrumbs-separator) / "";
```

Generated content **is** exposed to assistive technology by default; the `/ ""` is what
removes it. Measured in Chromium, the accessibility tree for the Separators variant holds
`Home`, `Projects`, `Atlas` and nothing else, across all four dividers.

Where a browser does not understand the alternative-text syntax the whole declaration is
invalid and no divider is drawn at all. That is the safe direction to fail in: a missing
line beats a spoken one.

## 5. The ellipsis is a button

A collapsed trail hides levels. If the mark standing in for them were a character, those
levels would be unreachable by pointer, by keyboard, and by screen reader alike. It is a
`button`, named for what it does — "Show 4 hidden levels" — and pressing it reveals the
whole path in place.

## 6. A trail refuses to collapse for one level

Putting a single level behind a button costs a press and saves almost no width. Collapsing
only happens when at least two levels can go away, which is why the third example on the
Collapsed variant stays whole even though its `max-items` is exceeded.

## 7. The current page is always marked

`aria-current="page"` on the last level. Whether it is a link or plain text is the author's
call — a self-referential link is still useful for reloading, and a `span` says plainly
that there is nowhere to go — but the marking is not optional, so the element fills it in
when the author has not.

## 8. Truncation before wrapping

In a narrow column the earlier levels give way and the current one never does, because
that is the piece of the trail that has to stay readable. The full text stays reachable
through the link's own `title`.

## 9. Responsive behavior and motion

- The list wraps by default; `data-truncate` trades wrapping for ellipsis.
- There is no motion to remove: expanding is an instant change of state, and animating a
  trail growing sideways would only delay the reading of it.

## 10. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Collapsed variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 11. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- The divider never appears in the accessibility tree.
- With scripting disabled the trail is still a working set of links.
- The collapsed ellipsis is a button with a name that counts what it hides.
- A trail that would hide only one level does not collapse.
- The current page carries `aria-current="page"` whether or not the author wrote it.
