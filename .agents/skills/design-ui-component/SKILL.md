---
name: design-ui-component
description: Thiết kế đặc tả cho UI component không phụ thuộc framework, gồm mục tiêu, variants, states, interaction, animation, responsive behavior, semantic tokens, accessibility, DESIGN.md và PROMPT.md. Dùng khi người dùng yêu cầu lên ý tưởng, thiết kế, mô tả hoặc lập spec cho component trước khi triển khai source.
---

# Design UI Component

Thiết kế component theo contract của repository nhưng giữ design system của component độc lập
với catalog shell.

## Quy trình

1. Đọc `.agents/rules/ui-component-rules.md`.
2. Đọc `docs/architecture.md`, `docs/component-authoring.md`,
   `docs/naming-conventions.md` và `schemas/component.schema.json`.
3. Xác định phạm vi:
   - Với catalog shell, đọc root `DESIGN.md`.
   - Với component mới, không áp đặt visual direction của catalog.
   - Với component hiện có, đọc `component.json`, `DESIGN.md`, `PROMPT.md`, `README.md`
     và source liên quan trong thư mục component.
4. Làm rõ mục tiêu, đối tượng sử dụng, nội dung, interaction chính và các constraint chưa có
   trong source-of-truth. Chỉ hỏi khi lựa chọn có thể làm thay đổi đáng kể kết quả.
5. Xác định:
   - Tên hiển thị và `kebab-case` ID đề xuất.
   - Variants tối thiểu có khác biệt hữu ích, không tạo biến thể chỉ để đổi màu trang trí.
   - States phù hợp như default, hover, focus, active, disabled, loading, success hoặc error.
   - Cấu trúc semantic HTML và hành vi bàn phím.
   - Responsive behavior và viewport preview.
   - Semantic tokens, spacing, typography, color, border, shadow và elevation.
   - Animation, timing, easing và fallback `prefers-reduced-motion`.
   - Contrast và accessibility acceptance criteria.
6. Kiểm tra thiết kế có thể triển khai bằng browser-ready HTML, CSS, JavaScript hoặc
   Tailwind mà không cần framework.

## Đầu ra

Khi người dùng yêu cầu tạo tài liệu thiết kế, chuẩn bị:

- `components/<id>/DESIGN.md`: mục tiêu, visual direction, anatomy, tokens, variants, states,
  responsive behavior, motion và accessibility.
- `components/<id>/PROMPT.md`: prompt tự đủ ngữ cảnh để tái tạo component cùng constraint,
  output structure và acceptance criteria.
- Đề xuất metadata cho `component.json`: name, description, categories, tags, technologies,
  variants và preview.

Nếu người dùng chỉ yêu cầu thảo luận hoặc thiết kế:

- Không tạo source HTML, CSS hoặc JavaScript.
- Không package component hoặc sinh preview.
- Không sửa root `DESIGN.md` trừ khi yêu cầu thực sự dành cho catalog shell.

## Done gate

- Phạm vi catalog và component đã được phân biệt rõ.
- Mỗi variant và state đều có lý do sử dụng.
- Keyboard, focus, contrast và reduced motion có acceptance criteria.
- Thiết kế không yêu cầu runtime hoặc style từ catalog.
- Không có quyết định contract nào được tự suy diễn khi source-of-truth chưa quy định.
