# UI Component Project Rules

Các quy tắc này áp dụng cho mọi agent làm việc trong `component-ui-collection`.

## 1. Chọn mode

### REVIEW-ONLY

Dùng khi người dùng yêu cầu review, đánh giá, kiểm tra, rà soát, phân tích hoặc cho ý kiến.

- Chỉ đọc, tìm kiếm, phân tích và đề xuất.
- Không tạo, sửa, xóa, format hoặc package file.
- Chỉ chạy lệnh không ghi output vào repository.
- Nếu phát hiện lỗi, đưa hướng sửa hoặc proposed diff nhưng không apply.

### IMPLEMENTATION WITH PREFLIGHT

Dùng khi người dùng yêu cầu tạo, sửa, implement, fix, refactor hoặc cập nhật trực tiếp.

- Được sửa file sau khi hoàn tất preflight.
- Chỉ thay đổi file trong phạm vi task.
- Nếu yêu cầu mơ hồ và có thể làm thay đổi contract hoặc thiết kế, hỏi lại trước phần đó.

## 2. Source-of-truth

Đọc nguồn phù hợp với phạm vi task:

| Phạm vi | Nguồn chuẩn |
|---|---|
| Kiến trúc, boundary và build flow | `docs/architecture.md` |
| Manifest và metadata contract | `schemas/component.schema.json` |
| Cấu trúc và quy trình authoring | `docs/component-authoring.md` |
| Folder, ID, variant và metadata naming | `docs/naming-conventions.md` |
| Giao diện website catalog | `DESIGN.md` ở root |
| Thiết kế component cụ thể | `components/<id>/DESIGN.md` |
| Ý định sinh component | `components/<id>/PROMPT.md` |
| Tích hợp và browser support | `components/<id>/README.md` |

Root `DESIGN.md` chỉ chi phối catalog shell, không áp đặt phong cách lên component được
preview. Nếu implementation khác nguồn chuẩn, báo rõ xung đột và không tự thay đổi contract.
Nếu chưa thấy thông tin cần thiết trong source-of-truth, nói rõ điều đó và hỏi người dùng khi
quyết định có thể ảnh hưởng kết quả.

## 3. Preflight

Trước khi nhận định hoặc sửa file:

1. Chạy `git status --short`.
2. Dùng `rg --files` và `rg` để tìm file liên quan.
3. Đọc `AGENTS.md` hoặc `CLAUDE.md`, rule này, skill được định tuyến và source-of-truth cần
   thiết.
4. Khi review thay đổi hiện có, dùng `git diff -- <file>` nếu file đã được Git theo dõi.
5. Không revert, ghi đè hoặc format file dirty không liên quan.
6. Khi sửa function, class, method hoặc code flow hiện có, thực hiện GitNexus impact analysis
   theo khối hướng dẫn trong file root. Thay đổi tài liệu hoặc tạo skill mới không cần impact
   analysis symbol.

## 4. Invariant kiến trúc

- Chỉ dùng HTML, CSS, JavaScript thuần hoặc Tailwind browser-ready.
- Không thêm React, Next.js hoặc UI framework.
- Vite chỉ là development server và build tool.
- Catalog và component là hai boundary độc lập.
- Catalog không import CSS hoặc JavaScript của component.
- Preview component chạy trong iframe.
- Component tải về không phụ thuộc token, CSS hoặc runtime của catalog.
- Không sửa thủ công nội dung trong `generated/` hoặc `dist/`.
- Không tạo Tailwind class bằng nối chuỗi động.

## 5. Contract component

- Mỗi component nằm trực tiếp tại `components/<kebab-case-id>/`; không dùng category làm
  folder cha.
- Folder name phải trùng `component.json.id`.
- Bắt buộc có `component.json`, `README.md`, `DESIGN.md`, `PROMPT.md` và ít nhất một
  `source/variants/<variant-id>/index.html`.
- `shared.css`, `shared.js` và `assets/` chỉ tạo khi thực sự cần.
- Tất cả đường dẫn trong manifest phải relative, không có `..` và không thoát component root.
- Mỗi variant phải hoạt động độc lập trong iframe và khớp entry khai báo trong manifest.
- Source và asset phân phối phải nằm trong thư mục của component.

## 6. Chất lượng UI

- Dùng semantic HTML trước khi thêm ARIA.
- Mọi interaction phải dùng được bằng bàn phím và có focus state nhìn thấy rõ.
- Text thông thường đạt contrast WCAG AA `4.5:1`; large text và UI boundary đạt `3:1`.
- Không dùng màu sắc làm tín hiệu trạng thái duy nhất.
- Hỗ trợ responsive behavior cho viewport được khai báo.
- Animation phải tôn trọng `prefers-reduced-motion`.
- Dùng semantic token cho vai trò thị giác; không trộn token catalog vào source component.
- Cung cấp trạng thái cần thiết như default, hover, focus, active, disabled, loading hoặc
  error khi phù hợp với loại component.

## 7. An toàn thay đổi

Không tự ý:

- Xóa file, rename lớn hoặc sửa ngoài phạm vi task.
- Sửa file dirty không liên quan.
- Chạy destructive command.
- Chạy `git add`, `git commit`, `git push`, force push, reset hard hoặc clean.
- Thêm dependency, hook, CI/CD, plugin hoặc framework ngoài yêu cầu.
- Thay đổi schema, URL contract hoặc component contract khi chưa xác nhận impact.

## 8. Verify và bàn giao

Trong implementation, chạy bộ kiểm tra gần nhất và an toàn:

```powershell
npm.cmd run validate:components
npm.cmd run verify
git status --short
```

Chỉ chạy preview generation hoặc packaging khi task cần những output đó. Sau khi sửa symbol
hiện có, dùng GitNexus `detect_changes()` để rà phạm vi trước khi người dùng commit.

Kết quả implementation gồm:

1. `Đã sửa`: file và thay đổi chính.
2. `Verify`: lệnh đã chạy cùng trạng thái pass/fail.
3. `Git status`: tóm tắt file thay đổi.
4. `Lưu ý tiếp theo`: chỉ thêm khi còn rủi ro hoặc việc cần làm.

Kết quả review-only gồm:

1. `Review findings`: sắp xếp theo mức nghiêm trọng, kèm file/dòng.
2. `Đề xuất sửa`: hướng sửa nhưng không apply.
3. `Rủi ro và lưu ý`: chỉ thêm khi có.
4. `Kiểm tra đề xuất`: lệnh chưa chạy hoặc kết quả kiểm tra read-only đã chạy.
