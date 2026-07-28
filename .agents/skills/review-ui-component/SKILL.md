---
name: review-ui-component
description: Review chỉ đọc UI component của component-ui-collection về manifest contract, cấu trúc source, portability, variants, UX, semantic HTML, keyboard interaction, contrast, responsive behavior, motion, tài liệu và khả năng package. Dùng khi người dùng yêu cầu review, đánh giá, kiểm tra, rà soát, phân tích lỗi hoặc cho ý kiến mà không yêu cầu sửa file.
---

# Review UI Component

Đánh giá component dựa trên source-of-truth và bằng chứng trong repository. Không tự động sửa
file trong quá trình review.

## Giữ read-only

- Không tạo, sửa, xóa, format, generate preview hoặc package file.
- Không chạy script ghi vào `generated/`, `dist/`, `preview/` hoặc source component.
- Có thể chạy `npm.cmd run validate:components` và `npm.cmd run test:unit` khi xác nhận các
  lệnh chỉ đọc đối với phạm vi review.
- Nếu người dùng yêu cầu sửa sau review, kết thúc review và chuyển sang
  `$build-ui-component` với preflight mới.

## Quy trình

1. Đọc `.agents/rules/ui-component-rules.md`.
2. Chạy `git status --short`, dùng `rg --files` để xác định phạm vi và đọc `git diff -- <file>`
   khi file đã được Git theo dõi.
3. Đọc nguồn chuẩn phù hợp:
   - `docs/architecture.md`
   - `schemas/component.schema.json`
   - `docs/component-authoring.md`
   - `docs/naming-conventions.md`
   - Tài liệu và source của component được review
4. Đối chiếu từng finding với contract hoặc hành vi quan sát được; không suy diễn lỗi chỉ từ
   sở thích thẩm mỹ.
5. Ưu tiên bug, regression, contract violation, lỗi accessibility và thiếu test trước các đề
   xuất polish.

## Checklist

### Contract và packaging

- Folder name, `id`, version, metadata và variant ID hợp lệ.
- Required docs và mọi variant entry tồn tại.
- Manifest path relative, không có traversal và không thoát component root.
- Source, docs, preview metadata và package contents nhất quán.

### Portability

- Variant chạy độc lập trong iframe.
- Không import CSS, token hoặc JavaScript của catalog.
- Asset và dependency được khai báo, đặt trong component hoặc có hướng dẫn tích hợp rõ.
- Tailwind output browser-ready và không có class được nối chuỗi động.

### UX và accessibility

- Semantic HTML phù hợp và ARIA không ghi đè native semantics.
- Interaction dùng được bằng bàn phím, có focus visible và thứ tự focus hợp lý.
- Disabled/loading/error state không tạo dead end hoặc thông báo chỉ bằng màu.
- Contrast đạt WCAG AA.
- Nội dung không vỡ ở viewport nhỏ, text zoom hoặc nội dung dài hợp lý.
- Animation không cản interaction và tôn trọng `prefers-reduced-motion`.

### Maintainability

- HTML, CSS và JavaScript không rò global ngoài phạm vi cần thiết.
- Event listener không bị đăng ký lặp hoặc phụ thuộc timing mong manh.
- Tên class, token và file nhất quán với tài liệu.
- Variant dùng lại shared source khi có lợi nhưng vẫn mở được từ entry riêng.

## Mức nghiêm trọng

- `P0`: mất dữ liệu, security issue nghiêm trọng hoặc không thể build/phân phối.
- `P1`: component hỏng chức năng chính, sai contract hoặc có accessibility blocker.
- `P2`: hành vi sai trong trường hợp thực tế, portability yếu hoặc thiếu coverage đáng kể.
- `P3`: cải thiện nhỏ về maintainability, consistency hoặc polish.

## Cách báo cáo

### Review findings

- Sắp xếp `P0` đến `P3`.
- Nêu file và dòng cụ thể.
- Mỗi finding phải giải thích điều kiện xảy ra, impact và contract hoặc tiêu chí bị vi phạm.
- Nếu không có finding, nói rõ không phát hiện lỗi và nêu rủi ro kiểm thử còn lại.

### Đề xuất sửa

Nêu hướng sửa hoặc proposed diff nhưng không apply.

### Rủi ro và lưu ý

Chỉ thêm khi thiếu context, source-of-truth xung đột, GitNexus stale hoặc chưa thể kiểm chứng
runtime behavior.

### Kiểm tra đề xuất

Liệt kê lệnh read-only đã chạy cùng kết quả và lệnh mutation chưa chạy vì đang review-only.
