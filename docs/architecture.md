# Project Architecture

This document and `schemas/component.schema.json` are the architectural source of truth for
`component-ui-collection`.

## Goal

The catalog is a static multi-page site without React, Next.js, or a UI framework. Vite provides
the development server, Tailwind processing for the catalog only, and production builds.

Each component is an independent distribution unit that:

- Opens its HTML entries without catalog JavaScript or CSS.
- Keeps every required source file and asset inside its own directory.
- Includes metadata, a recreation prompt, and design documentation.
- Provides at least one iframe-ready variant.

## Boundaries

- `catalog/` contains only catalog website code.
- `components/` contains only distributable component content.
- `generated/` contains intermediate build data.
- `dist/` contains deployable output and ZIP packages.
- `tests/fixtures/` never enters the production registry.

The catalog never imports component CSS or JavaScript. Preview entries run in iframes to isolate
layout, styles, and global variables.

## Build flow

```text
English validation
        |
components/*/component.json
        |
component validation
        |
        +----> generated/components-index.json
        |                     |
        |                     +----> Vite multi-page build
        |
        +----> publish source, docs, thumbnail, QA previews, and ZIP
                                      |
                                      +----> dist/
```

`pnpm run build` stops when English content, a manifest, documentation, an entry, a thumbnail, or
a required production preview is invalid.

## Manifest and registry

Schema version 2 adds a top-level taxonomy group, English descriptions for every variant, and an
authored static SVG thumbnail. The generated registry resolves public URLs and includes a stable
list of distributable text/code source files for the detail page.

## URL contract

- `index.html`: grouped catalog and search.
- `component.html?id=<component-id>`: component detail.
- `components/<id>/...`: published source, docs, thumbnail, and preview assets.
- `downloads/<id>-<version>.zip`: component distribution package.

Every runtime URL resolves relative to `document.baseURI`, allowing deployment under a subpath.

## Trust model

Repository components are trusted in the current version. The iframe isolates presentation but
is not a security boundary for untrusted contributions. External uploads would require a
separate origin and a stricter sandbox policy.
