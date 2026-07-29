# UI Component Project Rules

These rules apply to every agent working in `component-ui-collection`. Communicate with the user
in Vietnamese, but write repository-owned content in English.

## 1. Select a mode

### REVIEW-ONLY

Use for review, evaluation, inspection, analysis, comparison, or advice.

- Read, search, analyze, and propose only.
- Do not create, edit, delete, format, preview, or package repository files.
- Run only commands that do not write repository output.
- Report findings and a proposed change without applying it.

### IMPLEMENTATION WITH PREFLIGHT

Use for create, change, implement, fix, refactor, or direct repository updates.

- Edit only after preflight.
- Change only files inside the approved task scope.
- Ask before making an unclear decision that would alter a contract or material design choice.

## 2. Source of truth

| Scope | Source |
|---|---|
| Architecture, boundaries, and build flow | `docs/architecture.md` |
| Manifest and metadata contract | `schemas/component.schema.json` |
| Component structure and delivery gates | `docs/component-authoring.md` |
| Directory, ID, variant, and metadata naming | `docs/naming-conventions.md` |
| Catalog interface | Root `DESIGN.md` |
| Component design | `components/<id>/DESIGN.md` |
| Recreation intent | `components/<id>/PROMPT.md` |
| Integration and browser support | `components/<id>/README.md` |

The root design system controls only the catalog shell. A component preview owns its design
system. Report conflicts with a source-of-truth document and do not silently change a contract.

## 3. Preflight

1. Run `git status --short`.
2. Locate relevant files with `rg --files` and `rg`.
3. Read the root bootstrap, this rule, the routed skill, and relevant source-of-truth documents.
4. Inspect targeted diffs when reviewing existing changes.
5. Preserve unrelated dirty files and avoid broad formatting.
6. Run GitNexus impact analysis before changing an existing function, class, method, or code
   flow. Documentation-only work does not require symbol impact analysis.

## 4. Component delivery gates

Apply this lifecycle to every new component and every behavior, variant, source, or distribution
contract change:

```text
INPUT_RECEIVED
  -> PLAN_APPROVAL_REQUIRED
  -> IMPLEMENTING
  -> AUTOMATED_GATES_PASSED
  -> AWAITING_USER_ACCEPTANCE
  -> DONE
```

- A raw prompt requires a decision-complete plan and stops at `PLAN_APPROVAL_REQUIRED`.
- An explicit request to implement an approved plan passes Gate 0.
- Gate 1 checks that manifest, source, README, DESIGN, and PROMPT are consistent.
- Gate 2 checks variants, preview, registry, detail page, ZIP, source inspection, and document
  downloads.
- Automated success never implies user acceptance.
- Only explicit approval in the current task changes status to `DONE`.
- A failed gate or requested revision changes status to `REWORK_REQUIRED`; rerun Gates 1 and 2
  after the change.
- Do not create an approval file or infer approval from tests, silence, or earlier work.
- Every component handoff ends with a plain final line `Status: <LIFECYCLE_STATUS>`.
- Allowed statuses are `PLAN_APPROVAL_REQUIRED`, `REWORK_REQUIRED`,
  `AWAITING_USER_ACCEPTANCE`, and `DONE`.
- Automated handoff uses the heading `Ready for acceptance` and ends with
  `Status: AWAITING_USER_ACCEPTANCE`.

## 5. Architecture invariants

- Use plain HTML, CSS, JavaScript, or browser-ready Tailwind.
- Do not add React, Next.js, or a UI framework.
- Vite is only a development server and build tool.
- Catalog and component remain independent boundaries.
- Component previews run in iframes.
- Downloaded components do not depend on catalog tokens, CSS, or runtime.
- Never edit `generated/` or `dist/` manually.
- Do not construct Tailwind class names dynamically.
- Repository-owned text, code strings, ARIA, tests, fixtures, docs, rules, and skills use English.

## 6. Component contract

- Place each component directly at `components/<kebab-case-id>/`.
- Directory name equals `component.json.id`.
- Require `component.json`, `README.md`, `DESIGN.md`, `PROMPT.md`,
  `preview/thumbnail.svg`, and at least one `source/variants/<variant-id>/index.html`.
- Keep paths relative, safe, and inside the component root.
- Every variant runs independently in an iframe and matches its manifest entry.
- Keep every distributable source file and asset in the component directory.

## 7. UI quality

- Prefer semantic HTML before ARIA.
- Support keyboard operation and visible focus.
- Normal text reaches WCAG AA `4.5:1`; large text and UI boundaries reach `3:1`.
- Do not communicate state only through color.
- Support the declared responsive viewport.
- Respect `prefers-reduced-motion`.
- Use semantic visual tokens and never mix catalog tokens into component source.
- Implement relevant default, hover, focus, active, disabled, loading, empty, and error states.

## 8. Change safety

Do not delete files, perform broad renames, edit unrelated dirty files, run destructive commands,
stage, commit, push, reset, clean, add an unapproved dependency, or change a shared contract
without impact review and user approval.

## 9. Verification and handoff

For a component source, behavior, variant, or preview change, run:

```powershell
pnpm.cmd run validate:english
pnpm.cmd run validate:components
pnpm.cmd run build:index
pnpm.cmd run generate:previews
pnpm.cmd run package:component <id>
pnpm.cmd run verify
git status --short
```

Run GitNexus change detection after changing existing JavaScript symbols. Handoff reports files
changed, verification commands and results, Git status, production URLs, and a manual acceptance
checklist. Keep the task at `AWAITING_USER_ACCEPTANCE` until explicit user approval.
