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
- `group`: one schema taxonomy group.
- `categories`: broad functional search terms.
- `tags`: specific searchable traits.
- `technologies`: only technologies required by the downloaded component.
- `variants[].description`: one English sentence that distinguishes the variant.

Do not construct Tailwind class names dynamically. Every class required by a component must be
present in its browser-ready source.
