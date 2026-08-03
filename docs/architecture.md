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
        +----> generated/bundles/<id>/<id>.{html,css,js}
        |                     |
        +----> generated/components-index.json
        |                     |
        |                     +----> Vite multi-page build
        |
        +----> publish source, docs, thumbnail, bundles, and ZIP
                                      |
                                      +----> dist/
```

`pnpm run build` stops when English content, a manifest, documentation, an entry, or a thumbnail
is invalid. It runs from a clean clone, so it never requires the generated poster and WebM: those
are gitignored QA evidence, no runtime URL requests them, and publishing therefore leaves them
out. `pnpm run validate:previews` owns that gate and runs inside `pnpm run verify`, where the
generated assets exist on disk.

## Manifest and registry

Schema version 2 adds a top-level taxonomy group, English descriptions for every variant, and an
authored static SVG thumbnail. The generated registry resolves public URLs and includes both the
full source listing and a `distribution` listing.

## Distribution bundle

Each component is also emitted as three ready-to-use files named after its ID: one HTML demo
built from the preview variant, one stylesheet, and one script. The detail page shows these
files.

The ZIP carries exactly what a consumer drops into a project: those three files, `README.md`,
and `assets/` when the component has one. Authoring documents and the source tree stay out. The
source tree would repeat the same code the bundle already contains, and `DESIGN.md` and
`PROMPT.md` have their own downloads on the detail page.

Variant pages reference assets from two directories down, so bundling rewrites those references
for the flat layout; leaving them alone would point outside the archive.

Local modules are concatenated in dependency order rather than passed through a bundler. The
result is published as human-readable source, so minification or module reordering would defeat
its purpose. Concatenated modules share a single top-level scope, so bundling fails with a named
collision instead of emitting a file that would throw a `SyntaxError`.

## URL contract

- `index.html`: grouped catalog and search.
- `component.html?id=<component-id>`: component detail.
- `components/<id>/...`: published source, docs, and thumbnail.
- `generated/bundles/<id>/<id>.{html,css,js}`: the three ready-to-use files.
- `downloads/<id>-<version>.zip`: component distribution package.

Archives are written to `dist/downloads`, which only sits beside the pages in a built
deployment. The development server therefore maps `/downloads` onto that directory and answers
404 when an archive is missing, because falling through to the HTML page would hand the browser a
document saved under a `.zip` name.

Every runtime URL resolves relative to `document.baseURI`, allowing deployment under a subpath.

## Trust model

Repository components are trusted in the current version. The iframe isolates presentation but
is not a security boundary for untrusted contributions. External uploads would require a
separate origin and a stricter sandbox policy.

The preview sandbox grants `allow-popups allow-popups-to-escape-sandbox` on top of
`allow-scripts allow-same-origin allow-forms allow-modals`. Without the first, every
`target="_blank"` in every preview is swallowed — silently, apart from one console line — so a
component offering a way out to a map, a specification or a repository loses it. Without the
second, the opened tab inherits the sandbox and cannot navigate itself, which leaves a tab
where nothing on the far side works. Neither flag lets a preview touch the page around it:
`allow-top-navigation` is still withheld, so a preview cannot navigate the catalog.
