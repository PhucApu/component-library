# Naming Conventions

## Directories and IDs

- Use `kebab-case`, for example `animated-gradient-button`.
- Place every component directly under `components/`.
- Do not change an ID when only the group, category, or display name changes.
- Use `kebab-case` for variant IDs, such as `soft-shadow` or `high-contrast`.
- The component directory name must exactly match `component.json.id`.

## Files

- Preserve contract names: `component.json`, `README.md`, `DESIGN.md`, and `PROMPT.md`.
- Every variant entry is named `index.html`.
- Shared files use concise descriptive names such as `shared.css` and `shared.js`.
- Assets use lowercase names, hyphens, and explicit file extensions.
- The catalog thumbnail is always `preview/thumbnail.svg`.

## Metadata

- `name`: readable display name.
- `description`: one English sentence describing the primary behavior or value.
- `kind`: optional, `component` or `animation`. Omit it for a component; the catalog reads a
  missing `kind` as `component`.
- `group`: exactly one taxonomy group from the table that matches `kind`.
- `categories`: broad functional search terms.
- `tags`: specific searchable traits.
- `technologies`: only technologies required by the downloaded component.
- `variants[].description`: one English sentence that distinguishes the variant.

Do not construct Tailwind class names dynamically. Every class required by a component must be
present in its browser-ready source.

## Taxonomy groups

The schema restricts `group` to these seven values whenever `kind` is `component` or absent, and
the Components tab renders them in this order. A component belongs to exactly one; everything
else it is also about goes in `categories` and `tags`.

| Group | Holds | Examples |
|---|---|---|
| `inputs` | Controls that collect or edit a value the user supplies | Text field, select, date picker, slider, toggle |
| `data-display` | Surfaces that present data the user reads rather than edits | Table, badge, avatar, list, stat tile |
| `feedback` | Reports system state or the outcome of an action | Toast, alert, progress bar, skeleton, empty state |
| `surface` | Containers whose own job is to frame other content | Card, modal, drawer, accordion, sheet |
| `navigation` | Moves the user between places or views | Breadcrumb, tabs, pagination, menu bar |
| `layout` | Arranges other elements in space without adding meaning | Grid, stack, split pane, container |
| `utilities` | Cross-cutting helpers with no primary visual surface | Visually hidden wrapper, portal, focus trap |

Ask what the component **produces**, not what it renders. A date picker opens a panel, but its
product is a value, so it is an input rather than a surface.

When two groups still look plausible:

- **inputs vs surface**: does the component own a value and announce changes to it? Then it is an
  input, however elaborate the surface it opens.
- **feedback vs data-display**: feedback is about the system or an action; data display is about
  the user's own data.
- **surface vs layout**: a surface has a visual identity and frames content; layout arranges and
  is otherwise invisible.
- **navigation vs inputs**: changing which view is shown is navigation; setting a value that a
  form submits is an input, even when both look like tabs.
- **utilities** is the last resort. If any other group fits, use that one.

Regrouping later is cheap: the ID, the directory, and every published path stay as they are. Only
the homepage section and the group link on the detail page move.

## Animation taxonomy groups

An entry with `kind` `animation` takes its `group` from this table instead, and the Animations
tab renders them in this order. No ID is shared with the component taxonomy, so a section anchor
identifies one tab as well as one group.

| Group | Holds | Examples |
|---|---|---|
| `loaders` | Motion that stands in for content that has not arrived | Spinner, progress ring, skeleton shimmer |
| `transitions` | Motion between two states of the same thing | Enter and exit, morph, shared element, page change |
| `pointer-effects` | Motion that answers the pointer directly | Hover reveal, magnetic button, cursor trail, tilt |
| `backgrounds` | Ambient motion behind other content | Gradient drift, particle field, animated mesh, noise |
| `text-effects` | Motion applied to type | Typing, scramble, split-letter reveal, marquee |
| `scroll-effects` | Motion driven by scroll position | Parallax, reveal on enter, progress-linked timeline, sticky sequence |

Ask what **drives** the motion, not what it is drawn on. A gradient that drifts on its own is a
background; the same gradient advanced by scroll position is a scroll effect.

Choose `kind` by asking what the entry is for. A component is judged by the behavior it
delivers, and its motion supports that behavior. An animation is the deliverable itself: remove
the motion and nothing is left. A switch that slides is a component; a page transition is an
animation.
