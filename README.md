# Component UI Collection

A framework-free catalog for reusable UI components written with HTML, CSS, JavaScript, and
browser-ready Tailwind CSS when appropriate.

## Requirements

- Node.js `>=24 <27` (the current workspace uses Node.js `25.9.0`)
- pnpm `11.17.0`
- Chromium managed by Playwright

PowerShell can block `.ps1` shims, so the examples use `pnpm.cmd` and do not require an
Execution Policy change.

If pnpm is not available, install the pinned version once:

```powershell
npm.cmd install --global pnpm@11.17.0
```

## Start the catalog

```powershell
pnpm.cmd install
pnpm.cmd exec playwright install chromium
pnpm.cmd run dev
```

Open the URL printed by Vite:

- `/index.html` is the grouped component catalog.
- `/component.html?id=<component-id>` is the interactive component detail page.

## Commands

```text
dev                    Start the Vite development server
validate:english       Enforce English repository-owned content
validate:components    Validate every manifest and distribution contract
build:index            Generate the normalized component registry
generate:previews      Generate poster and WebM QA assets
package:component      Create one component ZIP
build                  Validate, build, publish, and package the catalog
preview                Serve the production build
test:unit              Run node:test coverage
test:e2e               Run Playwright coverage
verify                 Run the complete automated gate
```

## Repository boundaries

- `catalog/`: catalog website source.
- `components/`: independent distributable components.
- `schemas/`: manifest contract.
- `generated/`: generated registry; never edit manually.
- `dist/`: production and downloadable output; never edit manually.
- `scripts/`: validation, registry, preview, packaging, and publishing tools.
- `docs/`: architecture and authoring source of truth.
- `tests/fixtures/`: isolated test data that never enters the catalog registry.

Every component lives directly at `components/<component-id>/`. Functional grouping belongs in
`component.json`, not a parent directory.

See [architecture](docs/architecture.md), [component authoring](docs/component-authoring.md),
[naming conventions](docs/naming-conventions.md), and the root [design system](DESIGN.md).
