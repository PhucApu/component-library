# Hướng dẫn tạo component

## Cấu trúc bắt buộc

```text
components/
└── animated-gradient-button/
    ├── component.json
    ├── README.md
    ├── DESIGN.md
    ├── PROMPT.md
    └── source/
        ├── shared.css
        ├── shared.js
        ├── assets/
        └── variants/
            └── default/
                └── index.html
```

`shared.css`, `shared.js` và `assets/` chỉ cần tạo khi component thực sự sử dụng.
Mỗi variant bắt buộc có `index.html`.

## Manifest

```json
{
  "schemaVersion": 1,
  "id": "animated-gradient-button",
  "version": "0.1.0",
  "name": "Animated Gradient Button",
  "description": "Button có gradient chuyển động và trạng thái hover rõ ràng.",
  "categories": ["button"],
  "tags": ["animated", "gradient", "hover"],
  "technologies": ["html", "css", "javascript"],
  "variants": [
    {
      "id": "default",
      "name": "Default",
      "entry": "source/variants/default/index.html"
    }
  ],
  "preview": {
    "variant": "default",
    "viewport": {
      "width": 800,
      "height": 600
    },
    "durationMs": 3000
  }
}
```

Folder name phải trùng hoàn toàn với `id`. Entry của variant phải có dạng
`source/variants/<variant-id>/index.html`.

## Nội dung tài liệu

- `README.md`: cách tích hợp, dependencies, browser support và ví dụ sử dụng.
- `DESIGN.md`: mục tiêu thị giác, tokens, spacing, states, animation và
  accessibility.
- `PROMPT.md`: prompt gốc hoặc prompt đã tinh chỉnh để tái tạo component.

## Quy trình authoring

```powershell
npm.cmd run validate:components
npm.cmd run build:index
npm.cmd run generate:previews
npm.cmd run package:component -- animated-gradient-button
npm.cmd run verify
```

Component dùng Tailwind phải cung cấp browser-ready output trong `source/`.
Catalog không compile Tailwind class thay cho component.
