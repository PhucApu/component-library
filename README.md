# Component UI Collection

Thư viện catalog cho các UI component độc lập framework, được viết bằng HTML,
CSS, JavaScript thuần và Tailwind CSS khi phù hợp.

## Yêu cầu môi trường

- Node.js `>=24 <27` (workspace hiện tại đang dùng Node.js `25.9.0`)
- npm
- Chromium do Playwright quản lý

PowerShell trên máy hiện tại chặn `npm.ps1`, vì vậy các ví dụ bên dưới dùng
`npm.cmd` và `npx.cmd`. Không cần thay đổi Execution Policy.

## Khởi động

```powershell
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run dev
```

Mở URL do Vite in ra. Hai entry page chính:

- `/index.html`: danh mục và tìm kiếm component.
- `/component.html?id=<component-id>`: trang chi tiết component.

## Các lệnh chính

```powershell
npm.cmd run validate:components
npm.cmd run build:index
npm.cmd run generate:previews
npm.cmd run package:component -- <component-id>
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd run verify
```

## Cấu trúc dữ liệu

- `catalog/`: mã nguồn website catalog.
- `components/`: mỗi thư mục con là một component độc lập.
- `schemas/component.schema.json`: contract metadata.
- `generated/`: registry sinh tự động, không chỉnh sửa thủ công.
- `dist/`: production build và ZIP download, không chỉnh sửa thủ công.
- `scripts/`: validate, generate registry/preview, package và publish.
- `docs/`: source-of-truth về kiến trúc và quy ước authoring.

Không đặt category làm thư mục cha. Component luôn có đường dẫn ổn định
`components/<component-id>/`, còn category nằm trong `component.json`.

Xem thêm:

- [Kiến trúc](docs/architecture.md)
- [Hướng dẫn tạo component](docs/component-authoring.md)
- [Quy ước đặt tên](docs/naming-conventions.md)
