# Component UI Collection — Design System

> **Name:** Curated Precision
> **Version:** 1.4.0
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

The direction is **quiet technical catalog**: near-black canvas, stepped neutral surfaces,
fine borders, cobalt actions, and cool blue focus or link accents. Do not use page glows,
gradient text, decorative autoplay, or a competing visual identity.

### Core colors

| Role | Value |
|---|---|
| Base surface | `#0B0C0E` |
| Subtle surface | `#111318` |
| Raised surface | `#171A20` |
| Overlay surface | `#1D2128` |
| Default border | `#292D36` |
| Strong border | `#3B414C` |
| Primary text | `#F4F6FA` |
| Secondary text | `#A8AFBC` |
| Tertiary text | `#777F8E` |
| Brand | `#4968E8` |
| Brand hover | `#4D6BE3` |
| Brand active | `#3857D6` |
| Link | `#91A8FF` |
| Focus | `#86A0FF` |

Primary, secondary, and tertiary text meet WCAG AA on the base surface. White on brand remains
at least `4.5:1`.

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
poster/video assets never appear on the homepage.

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
9. Source Package heading, version, and ZIP action.
10. Source Code, Prompt, and Design System accordions.

The closed iframe uses the intrinsic height of its trusted same-origin demo instead of reserving
the full preview viewport. When an accessible control inside the iframe exposes
`aria-expanded="true"`, the iframe overlays following detail sections at
`preview.viewport.height` while the stage keeps its compact closed height. The overlay remains
below the sticky header, resets on close or variant change, and never injects catalog tokens into
component source. A cross-origin or unreadable preview falls back to the manifest height.

## 8. Source Package

Use native `<details>/<summary>` controls. All panels start closed and only one may remain open.

- Source Code provides a native file selector and raw text viewer.
- Prompt provides raw `PROMPT.md` and a download action.
- Design System provides raw component `DESIGN.md` and a download action.

Use `textContent` for fetched source and documents. Do not add Markdown rendering or syntax
highlighting dependencies.

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

Update this document with any shared palette, typography, information architecture, or spacing
change. Component-level decisions belong in `components/<id>/DESIGN.md`.
