# Component UI Collection — Design System

> **Name:** Curated Precision
> **Version:** 1.5.0
> **Scope:** Catalog homepage and component detail page

## 1. Purpose and boundary

The catalog is a quiet technical library that makes independent UI components easy to scan,
preview, inspect, and download. This document controls only the catalog shell. Every iframe
component owns its design tokens and must remain usable without catalog CSS or JavaScript.

## 2. Principles

1. Components are the primary content; catalog decoration remains restrained.
2. Semantic tokens express visual roles rather than one-off colors.
3. English copy is concise, literal, and useful to technical readers.
4. Keyboard focus, contrast, responsive behavior, and reduced motion are baseline requirements.
5. HTML, CSS, JavaScript, and browser-ready Tailwind remain framework independent.

## 3. Visual direction

The direction is **quiet technical catalog**: stepped neutral surfaces, fine borders, cobalt
actions, and cool blue focus or link accents. Do not use page glows, gradient text,
decorative autoplay, or a competing visual identity. The catalog ships both a dark and a
light theme and reads the same in each; the light theme is the same catalog on a white
canvas, not a second visual identity.

### Core colors

| Role | Dark | Light |
|---|---|---|
| Base surface | `#0B0C0E` | `#FFFFFF` |
| Subtle surface | `#111318` | `#F7F8FA` |
| Raised surface | `#171A20` | `#FFFFFF` |
| Overlay surface | `#1D2128` | `#FFFFFF` |
| Inset surface | `#0F1115` | `#EFF2F6` |
| Default border | `#292D36` | `#D0D5DD` |
| Strong border | `#3B414C` | `#B4BCC7` |
| Primary text | `#F4F6FA` | `#15181D` |
| Secondary text | `#A8AFBC` | `#4B525E` |
| Tertiary text | `#777F8E` | `#626A77` |
| Brand | `#4968E8` | `#4968E8` |
| Brand hover | `#4D6BE3` | `#4D6BE3` |
| Brand active | `#3857D6` | `#3857D6` |
| Link | `#91A8FF` | `#3857D6` |
| Focus | `#86A0FF` | `#3857D6` |

Primary, secondary, and tertiary text meet WCAG AA on their own base surface. White on
brand remains at least `4.5:1`, which is why brand does not move between themes. The link
and focus roles do move: the pale blue that carries a dark canvas reaches only `1.9:1` on
white, so the light theme takes those roles down to the brand-active cobalt at `5.99:1`.

Measured on the light canvas: secondary text `7.87:1`, tertiary text `5.46:1`, link and
eyebrow `5.99:1`.

### Themes

- Every catalog colour is a semantic token declared once per theme. A rule names a token;
  it never names a hex value, an `rgb()` literal, or a translucent white.
- `:root[data-theme="light"]` and `:root[data-theme="dark"]` carry the two sets, and dark
  also carries the unqualified declarations. The catalog builds its grid from JavaScript,
  so a document that never receives `data-theme` never had a catalog to theme, and the
  authored dark surface is the safe resting state.
- An inline bootstrap in each page head resolves the theme before first paint: a stored
  choice if there is one, otherwise `prefers-color-scheme`. Resolving it from a module
  would repaint a page the browser has already drawn.
- The header carries one two-state toggle. It stores the choice under
  `component-ui-theme`, and its icon and accessible name state the theme the click
  applies rather than the theme already on screen.
- An explicit choice outranks the operating system until it is cleared. The catalog only
  keeps following the system while nothing is stored.
- Both themes ship the same states, the same borders, and the same focus treatment.

## 4. Typography and icons

- Use self-hosted `"Geist"` with `"Geist Fallback"` and system fonts for UI text.
- Use self-hosted `"Geist Mono"` for paths, versions, code, and keyboard shortcuts.
- Preload only Geist Sans; load Geist Mono when required.
- Use inline Lucide SVG paths with `.ui-icon`, `currentColor`, and stroke width `1.75`.
- Decorative icons use `aria-hidden="true"`; icon-only controls require an accessible name.
- Important actions retain visible text next to the icon.

## 5. Layout

- Sticky header height: `56px`.
- Homepage content width: approximately `1088px`.
- Detail content width: approximately `1216px`.
- Mobile gutter: `16px`; desktop gutter: `24px`.
- Display heading: `clamp(2.25rem, 5vw, 3rem)` or equivalent on detail.
- Use one column below `42rem`, two columns from `42rem`, and three from `64rem`.
- Never introduce horizontal overflow from a `320px` viewport.

## 6. Homepage information architecture

The homepage contains a header, centered hero, search field, result summary, and grouped
component sections. Groups follow the shared taxonomy order:

`Inputs`, `Data display`, `Feedback`, `Surface`, `Navigation`, `Layout`, `Utilities`.

Render only non-empty groups. Group headings expose stable anchors and cards sort by component
name. Search matches ID, name, description, group ID, group label, categories, and tags.

Cards use the authored static `preview/thumbnail.svg` on a dark neutral canvas. The complete card
is one link. The footer contains only component name and compact technology metadata. Generated
poster/video assets never appear on the homepage and are not published at all.

## 7. Detail information architecture

Top-level content follows one vertical sequence:

1. Group link to the homepage anchor.
2. Component name.
3. Short description.
4. Technology badges.
5. Interactive Preview heading.
6. Variant controls.
7. Full-width interactive stage.
8. Active variant name and description.
9. Source Package heading.
10. Source Code, Prompt, and Design System accordions.

The preview stage holds one constant height taken from `preview.viewport.height` in every state.
A component panel opens inside the iframe and cannot escape it, so a height that changed on open
would reflow the whole page around the stage. The stage never injects catalog tokens into
component source.

### Telling a preview which theme is showing

A preview owns its own palette, so the catalog cannot restyle it and must ask instead. On
load and on every theme change the stage sets `color-scheme` on the frame element and
posts `{ type: 'ui-theme', theme: 'light' | 'dark' }` to the frame's own origin.

The message is the whole contract. It carries a theme keyword and no catalog identity, no
token, and no stylesheet, so a component that answers it gains no dependency on the
catalog: the same listener serves any host that embeds it, and a component opened on its
own never receives the message and keeps following `prefers-color-scheme`. A component
that ignores the message keeps its own colours, and the stage stays correct either way.

Answering it is therefore optional per component and is recorded in that component's
`DESIGN.md`. Components that answer it today: `breadcrumbs`, `card`, `chip`, `pagination`,
`radio-group`, `switch`, `table`, `text-field`.

Still to convert: `accordion`, `autocomplete`, `carousel`, `drawer`, `lightbox`,
`locator-map`, `snackbar`, `temporal-picker`.

## 8. Source Package

Use native `<details>/<summary>` controls. Only one panel may remain open. Source Code starts
open so the ZIP action inside it stays discoverable. Opening and closing animate the panel height
over `260ms`, and `prefers-reduced-motion` drops straight to the end state.

- Source Code provides the file picker, the ZIP download action, and a raw text viewer.
- Prompt provides raw `PROMPT.md` and a download action.
- Design System provides raw component `DESIGN.md` and a download action.

The file picker lists the three distributable files by file name, each with an icon for its file
type. It is a button plus a `role="listbox"` surface rather than a native `<select>`, because an
`<option>` cannot carry an icon and the native popup is drawn by the operating system and cannot
match this surface. It supports Arrow keys, Home, End, Enter, Escape, and outside-pointer
dismissal.

Every document pane carries a copy action in its top-right corner that writes the raw text to the
clipboard and reports the result through a live region.

Use `textContent` for fetched source and documents. Request source with the `?source-view` marker
so the development server returns the byte-for-byte file instead of a transformed module. Do not
add Markdown rendering or syntax highlighting dependencies.

## 9. Interaction and accessibility

- Use semantic HTML before ARIA.
- Every interaction is keyboard operable with visible `:focus-visible`.
- Normal text reaches `4.5:1`; large text and UI boundaries reach `3:1`.
- Do not communicate state only through color.
- Search shortcut `/` works only when focus is outside inputs, textareas, and selects.
- Variant buttons expose pressed state and update the iframe plus active description together.
- Loading, empty, fallback, and error messages use English.

## 10. Motion and governance

Hover movement is limited to `translateY(-2px)`. Prefer transform and opacity transitions from
`120–180ms`. Respect `prefers-reduced-motion` globally. Static thumbnails never animate.

Switching theme crosses the existing `120–180ms` colour transitions rather than adding a
transition of its own, and `prefers-reduced-motion` already drops those to nothing.

Update this document with any shared palette, typography, information architecture, or spacing
change. A new theme token is a shared palette change and belongs here. Component-level
decisions, including whether a component answers the preview theme message, belong in
`components/<id>/DESIGN.md`.
