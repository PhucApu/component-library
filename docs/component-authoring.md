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

## Documentation

- `README.md`: integration, dependencies, browser support, and usage.
- `DESIGN.md`: purpose, visual tokens, variants, states, motion, responsive behavior, and
  accessibility.
- `PROMPT.md`: self-contained English instructions that can recreate every published variant.
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
