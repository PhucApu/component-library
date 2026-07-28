# Quy ước đặt tên

## Folder và ID

- Dùng `kebab-case`: `animated-gradient-button`.
- Không dùng category làm folder cha.
- Không đổi ID chỉ vì component đổi category hoặc display name.
- Variant ID cũng dùng `kebab-case`: `soft-shadow`, `high-contrast`.

## File

- Giữ nguyên các tên contract: `component.json`, `README.md`, `DESIGN.md`,
  `PROMPT.md`.
- Entry của mỗi variant luôn là `index.html`.
- File dùng chung nên có tên mô tả ngắn: `shared.css`, `shared.js`.
- Asset dùng chữ thường, dấu gạch ngang và có đuôi rõ ràng.

## Metadata

- `name`: tên hiển thị dễ đọc.
- `description`: một câu mô tả hành vi hoặc giá trị chính.
- `categories`: nhóm chức năng rộng, ví dụ `button`, `navigation`.
- `tags`: đặc điểm tìm kiếm, ví dụ `animated`, `glass`, `hover`.
- `technologies`: công nghệ thực sự cần để dùng component, ví dụ `html`, `css`,
  `javascript`, `tailwind`.

Không tạo class Tailwind bằng nối chuỗi động. Các class cần xuất hiện đầy đủ
trong source để quá trình compile có thể phát hiện chúng.
