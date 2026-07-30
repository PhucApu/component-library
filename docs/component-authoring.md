# Component Authoring

## Required structure

```text
components/
└── animated-gradient-button/
    ├── component.json
    ├── README.md
    ├── DESIGN.md
    ├── PROMPT.md
    ├── preview/
    │   └── thumbnail.svg
    └── source/
        ├── shared.css
        ├── shared.js
        ├── assets/
        └── variants/
            └── default/
                └── index.html
```

Create shared files and assets only when the component uses them. Every declared variant must
have an independent `index.html`.

Packaging derives three ready-to-use files from this tree: `<id>.css` from the root stylesheet,
`<id>.js` from the root modules concatenated in dependency order, and `<id>.html` from the
preview variant. Root modules therefore must not declare the same top-level name twice; move a
shared helper into one module and import it.

The published ZIP holds those three files, `README.md`, and `source/assets/` when present.
Because `README.md` is the only authoring document a consumer receives, keep integration steps,
dependencies, and browser support there rather than in `DESIGN.md`.

## Manifest version 2

```json
{
  "schemaVersion": 2,
  "id": "animated-gradient-button",
  "version": "0.1.0",
  "name": "Animated Gradient Button",
  "description": "A button with a restrained animated gradient and clear interaction states.",
  "group": "inputs",
  "categories": ["button"],
  "tags": ["animated", "gradient", "hover"],
  "technologies": ["html", "css", "javascript"],
  "variants": [
    {
      "id": "default",
      "name": "Default",
      "description": "A balanced default treatment for primary actions.",
      "entry": "source/variants/default/index.html"
    }
  ],
  "preview": {
    "variant": "default",
    "thumbnail": "preview/thumbnail.svg",
    "viewport": {
      "width": 800,
      "height": 600
    },
    "durationMs": 3000
  }
}
```

Allowed groups are `inputs`, `data-display`, `feedback`, `surface`, `navigation`, `layout`, and
`utilities`. Folder name and manifest ID must match. Variant entries always follow
`source/variants/<variant-id>/index.html`.

## Preview frame contract

The detail page renders each variant in an iframe fixed at `preview.viewport.height` in every
state. The height never reacts to the component, because a panel or menu opens inside the iframe
and cannot escape it, so a frame that grew on open would reflow the whole page around it.

Two consequences for a variant page:

- Give the demo page a minimum height of `100dvh`. It is otherwise as tall as its content, and
  any background it paints stops there, leaving a visible seam across the rest of the frame.
- Pick `preview.viewport.height` large enough for the component's tallest open state. Anything
  that does not fit is clipped by the iframe.

## Portability

A downloaded component runs without catalog CSS or JavaScript, and validation enforces this:

- Every CSS custom property the source reads through `var()` must also be defined in that same
  component's source. The check compares definitions rather than a name prefix, so a component
  may name its tokens whatever it likes.
- No source file may reference a `catalog/` path. A same-origin stylesheet link would slip past
  the browser test for external requests, so this is caught during validation instead.

A component built on browser-ready Tailwind would need these rules relaxed for the properties
Tailwind generates. No component does that today.

## Documentation

- `README.md`: integration, dependencies, browser support, and usage.
- `DESIGN.md`: purpose, visual tokens, variants, states, motion, responsive behavior, and
  accessibility.
- `PROMPT.md`: self-contained English instructions that can recreate every published variant.
- `PROMPT-STANDALONE.md`: optional. Instructions that recreate the distributable three files
  instead of the repository layout, for handing to a tool with no access to this repository. The
  registry links it and the detail page offers it as a second download when it exists.
- Root docs and schema change only when the shared repository contract changes.

## Component delivery lifecycle

```text
INPUT_RECEIVED
  -> PLAN_APPROVAL_REQUIRED
  -> IMPLEMENTING
  -> AUTOMATED_GATES_PASSED
  -> AWAITING_USER_ACCEPTANCE
  -> DONE
```

### Gate 0 — Plan approval

Analyze raw input and lock the ID, group, variants, API, value contract, states, interactions,
responsive behavior, accessibility, reduced motion, source structure, preview, tests, and file
scope. A raw prompt does not authorize implementation. An explicit request to implement an
approved plan passes this gate.

### Gate 1 — Documentation and contract

Before generating previews or packages, confirm that the manifest, source, README, DESIGN, and
PROMPT describe the same behavior and that every declared file and variant exists. A failure
changes the task status to `REWORK_REQUIRED`.

### Gate 2 — Automated delivery

For a component behavior, variant, source, or preview change, run:

```powershell
pnpm.cmd run validate:english
pnpm.cmd run validate:components
pnpm.cmd run build:index
pnpm.cmd run generate:previews
pnpm.cmd run package:component animated-gradient-button
pnpm.cmd run verify
```

Verify independent variants, registry data, detail rendering, the static thumbnail, generated QA
previews, keyboard support, responsiveness, document downloads, and ZIP contents. A
documentation-only component change may skip preview generation but still requires validation,
packaging, and full verification.

Automated success moves immediately from `AUTOMATED_GATES_PASSED` to
`AWAITING_USER_ACCEPTANCE`; it is not user acceptance.

### Gate 3 — User acceptance

Hand off a production URL and a manual checklist for variants, interactions, responsiveness, raw
output, source inspection, prompt/design downloads, and ZIP download. Only explicit approval in
the current task changes status to `DONE`. Feedback changes status to `REWORK_REQUIRED`, after
which Gates 1 and 2 run again.

### Output contract

Every component handoff ends with:

```text
Status: <LIFECYCLE_STATUS>
```

The status is a closed enum: `PLAN_APPROVAL_REQUIRED`, `REWORK_REQUIRED`,
`AWAITING_USER_ACCEPTANCE`, or `DONE`. Do not infer acceptance from automated tests, silence, or
approval of another component.

Tailwind components must distribute browser-ready output. The catalog never compiles Tailwind
for a component.
