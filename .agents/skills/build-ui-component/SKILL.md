---
name: build-ui-component
description: Tạo hoặc sửa UI component không phụ thuộc framework bằng HTML, CSS, JavaScript hoặc Tailwind browser-ready theo contract của component-ui-collection. Dùng khi người dùng yêu cầu implement, build, fix, refactor hoặc hoàn thiện component, manifest, variants, source, tài liệu, preview hay package tải về.
---

# Build UI Component

Triển khai component như một đơn vị phân phối độc lập, có thể chạy trong iframe mà không phụ
thuộc CSS hoặc JavaScript của catalog.

## Preflight

1. Đọc `.agents/rules/ui-component-rules.md`.
2. Chạy `git status --short` và tìm file liên quan bằng `rg`.
3. Đọc `docs/architecture.md`, `docs/component-authoring.md`,
   `docs/naming-conventions.md` và `schemas/component.schema.json`.
4. Khi component đã tồn tại, đọc toàn bộ `component.json`, `README.md`, `DESIGN.md`,
   `PROMPT.md` và source liên quan.
5. Nếu sửa symbol hoặc code flow hiện có, chạy GitNexus impact analysis trước khi sửa và cảnh
   báo người dùng khi impact HIGH hoặc CRITICAL.
6. Không ghi đè file dirty không liên quan.

## Triển khai

### 1. Khóa contract

- Dùng ID và variant ID dạng `kebab-case`.
- Đặt component trực tiếp tại `components/<id>/`.
- Đảm bảo folder name trùng `component.json.id`.
- Khai báo đường dẫn relative, không có `..` và không thoát component root.
- Không thay đổi schema hoặc URL contract khi chưa được người dùng xác nhận.

### 2. Tạo cấu trúc tối thiểu

```text
components/<id>/
├── component.json
├── README.md
├── DESIGN.md
├── PROMPT.md
└── source/
    └── variants/
        └── <variant-id>/
            └── index.html
```

Chỉ thêm `shared.css`, `shared.js` hoặc `assets/` khi component thực sự dùng chúng.

### 3. Viết source

- Dùng semantic HTML trước ARIA.
- Giữ HTML entry mở được trực tiếp từ source đã publish.
- Dùng CSS custom properties làm theme interface khi cần tùy biến.
- Nếu dùng Tailwind, cung cấp output browser-ready trong `source/`; catalog không compile
  Tailwind thay component.
- Không tạo class Tailwind bằng nối chuỗi động.
- Không import style, token hoặc runtime của catalog.
- Giữ mọi asset cần phân phối trong thư mục component.
- Hỗ trợ keyboard, focus visible, contrast WCAG AA, responsive behavior và
  `prefers-reduced-motion`.
- Triển khai đầy đủ states và variants đã được chốt trong `DESIGN.md`.

### 4. Đồng bộ tài liệu

- `README.md`: cách tích hợp, dependencies, browser support và ví dụ sử dụng.
- `DESIGN.md`: visual direction, anatomy, tokens, variants, states, responsive, motion và
  accessibility.
- `PROMPT.md`: prompt tự đủ ngữ cảnh để tái tạo component.
- `component.json`: metadata và preview contract khớp source thực tế.

Không để tài liệu mô tả variant, state hoặc dependency chưa tồn tại trong source.

## Verify

Chạy theo phạm vi:

```powershell
npm.cmd run validate:components
npm.cmd run build:index
npm.cmd run generate:previews
npm.cmd run package:component -- <id>
npm.cmd run verify
```

Không sửa thủ công output trong `generated/` hoặc `dist/`. Nếu task không cần preview hay ZIP,
bỏ qua hai lệnh tạo output tương ứng nhưng vẫn chạy validation và verify gần nhất.

Sau khi sửa symbol hiện có, chạy GitNexus `detect_changes()` để kiểm tra blast radius trước khi
người dùng commit. Luôn chạy lại `git status --short` khi bàn giao.

## Done gate

- Manifest và folder vượt qua validator.
- Mỗi variant entry tồn tại và chạy độc lập.
- Source, docs, metadata và preview không lệch nhau.
- Component không phụ thuộc catalog hoặc framework.
- Keyboard, focus, contrast, responsive và reduced motion đã được kiểm tra.
- Verify pass hoặc lỗi còn lại được báo rõ cùng bước tiếp theo.
