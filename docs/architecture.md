# Kiến trúc dự án

Tài liệu này cùng `schemas/component.schema.json` là source-of-truth ban đầu của
`component-ui-collection`.

## Mục tiêu

Catalog phải chạy dưới dạng static site, không phụ thuộc React, Next.js hoặc UI
framework. Vite chỉ cung cấp development server, xử lý Tailwind CSS và build
production assets.

Component là đơn vị sở hữu độc lập. Mỗi component phải:

- Mở được entry HTML mà không cần JavaScript hoặc CSS của catalog.
- Giữ toàn bộ source và asset bên trong thư mục của chính nó.
- Có metadata, prompt và tài liệu thiết kế.
- Có ít nhất một variant có thể chạy trong iframe.

## Ranh giới thư mục

- `catalog/` chỉ chứa code website danh mục.
- `components/` chỉ chứa nội dung component được phân phối.
- `generated/` là dữ liệu trung gian sinh từ manifest.
- `dist/` là output deploy/download.
- `tests/fixtures/` chỉ phục vụ kiểm thử và không được scan vào registry.

Không import CSS/JavaScript của một component vào catalog. Catalog tải preview
qua iframe để tránh xung đột layout, style và global variables.

## Luồng build

```text
components/*/component.json
          │
          ▼
validate-components
          │
          ├──► generated/components-index.json
          │                │
          │                ▼
          │           Vite multi-page build
          │
          └──► publish source/docs/preview + ZIP
                           │
                           ▼
                          dist/
```

`npm run build` dừng ngay nếu manifest, tài liệu, entry hoặc preview production
không hợp lệ.

## URL contract

- `index.html`: load registry và render/search danh mục.
- `component.html?id=<component-id>`: tìm component theo ID.
- `components/<id>/...`: source, docs và preview đã publish.
- `downloads/<id>-<version>.zip`: gói tải về.

Tất cả URL được tạo relative với `document.baseURI` để production build có thể
được deploy dưới subpath.

## Mô hình tin cậy

V1 coi component trong repository là nguồn tin cậy. Iframe được dùng chủ yếu để
cô lập CSS và runtime, chưa phải security boundary cho contribution không tin
cậy. Nếu cho phép upload hoặc contribution bên ngoài, preview phải chuyển sang
origin riêng và có sandbox policy chặt hơn.
