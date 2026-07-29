---
name: build-ui-component
description: Create or change portable, framework-free UI components using browser-ready HTML, CSS, JavaScript, or Tailwind while following the component-ui-collection contract.
---

# Build UI Component

Build each component as an independent distribution unit that runs in an iframe without catalog
CSS or JavaScript.

## Preflight

1. Read `.agents/rules/ui-component-rules.md`.
2. Run `git status --short` and locate relevant files with `rg`.
3. Read architecture, authoring, naming, schema, and all existing component documents and source.
4. Run GitNexus impact analysis before changing an existing symbol or code flow.
5. Preserve unrelated dirty files.
6. Confirm Gate 0. A raw prompt stops at `PLAN_APPROVAL_REQUIRED`.

## Build

- Lock a `kebab-case` ID, group, variants, API, value contract, and safe relative paths.
- Place the component directly in `components/<id>/`.
- Provide manifest schema version 2, English variant descriptions, and
  `preview/thumbnail.svg`.
- Use semantic HTML, visible focus, keyboard support, WCAG AA contrast, responsive behavior, and
  reduced-motion fallbacks.
- Keep CSS custom properties and all runtime assets component-owned.
- Do not import catalog styles, tokens, runtime, or a framework.
- Keep README, DESIGN, PROMPT, manifest, tests, and source behavior consistent.

## Delivery gates

Gate 1 compares manifest, source, README, DESIGN, and PROMPT. Gate 2 runs English validation,
component validation, registry generation, preview generation, packaging, publishing, unit
tests, and E2E tests appropriate to the change.

After JavaScript changes, run GitNexus change detection. Automated success ends with a production
URL, a manual checklist, and `Status: AWAITING_USER_ACCEPTANCE`. Only explicit user approval in
the current task permits `Status: DONE`.
