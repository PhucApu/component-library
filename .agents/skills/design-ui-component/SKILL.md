---
name: design-ui-component
description: Design framework-free UI component specifications, variants, states, interactions, motion, responsiveness, accessibility, DESIGN.md, and PROMPT.md for component-ui-collection.
---

# Design UI Component

Create a decision-complete specification before implementation.

## Workflow

1. Read the project rule and relevant architecture, authoring, naming, schema, and design sources.
2. Separate the catalog design system from the component-owned design system.
3. Define purpose, group, use cases, variants, states, API, value contract, interactions,
   responsive behavior, semantic tokens, motion, reduced motion, keyboard support, and
   accessibility.
4. Define the source structure, authored static thumbnail, test scope, and distribution files.
5. Resolve framework conflicts by translating input into plain HTML, CSS, and JavaScript.
6. Produce or synchronize `DESIGN.md`, `PROMPT.md`, and manifest metadata only when the user
   authorizes file changes.

A raw component prompt produces a plan and stops with `Status: PLAN_APPROVAL_REQUIRED`. Do not
write implementation source until the user approves the plan.
