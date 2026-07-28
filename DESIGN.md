# Component UI Collection — Design System

> **Design system:** Curated Precision  
> **Version:** 1.0.0  
> **Status:** Initial source-of-truth  
> **Scope:** Website catalog và trang chi tiết component

## 1. Mục đích và phạm vi

Tài liệu này định nghĩa ngôn ngữ hình ảnh, semantic token, interaction state và
accessibility baseline của **website catalog**.

Tài liệu này **không áp đặt giao diện lên component được trưng bày**:

- Catalog sử dụng token trong `catalog/styles/`.
- Preview component chạy trong iframe và giữ design system riêng.
- Source component tải xuống không được phụ thuộc vào CSS hoặc token của catalog.
- `components/<id>/DESIGN.md` mô tả quyết định thiết kế riêng của component đó.

Khi có xung đột:

1. `DESIGN.md` ở root là source-of-truth cho catalog shell.
2. `components/<id>/DESIGN.md` là source-of-truth cho component tương ứng.
3. `catalog/styles/` là implementation và phải được cập nhật theo tài liệu này.

## 2. Nguyên tắc cốt lõi

### 2.1 Semantic-first

- Luôn sử dụng token theo **vai trò**: `--text-primary`, `--surface-base`,
  `--status-success-fg`.
- Không sử dụng primitive color trực tiếp trong catalog component CSS.
- Raw hex, RGB hoặc OKLCH chỉ được định nghĩa trong file token gốc.
- Không dùng một token cho nhiều vai trò không liên quan.

Ví dụ:

```css
/* Sai */
color: #a8ff78;
border-color: rgb(168 255 120 / 0.45);

/* Đúng */
color: var(--text-link);
border-color: var(--border-brand);
```

### 2.2 Component là tâm điểm

Catalog phải tạo bối cảnh trung tính để component nổi bật. Decoration của
catalog không được cạnh tranh với preview, animation hoặc nội dung component.

### 2.3 Accessible by default

- Text body phải đạt WCAG AA, contrast tối thiểu `4.5:1`.
- Large text và UI boundary phải đạt tối thiểu `3:1`.
- Focus state phải luôn nhìn thấy bằng bàn phím.
- Không dùng màu sắc làm tín hiệu trạng thái duy nhất.
- Animation phải tôn trọng `prefers-reduced-motion`.

### 2.4 Framework-free và portable

- Design không phụ thuộc React, Next.js hoặc component framework.
- CSS custom property là interface theme chính.
- Tailwind chỉ ánh xạ tới semantic token, không trở thành source-of-truth.

### 2.5 Ít nhưng có chủ đích

- Một primary action rõ ràng cho mỗi khu vực.
- Surface elevation được dùng để thể hiện hierarchy, không để trang trí.
- Border, shadow, gradient và glow phải có semantic role.

## 3. Visual direction — “Curated Precision”

**Curated Precision** kết hợp:

- Sự chính xác, có hệ thống và chuyên nghiệp của một công cụ kỹ thuật.
- Cảm giác khám phá, sáng tạo của một thư viện UI tương tác.
- Nền tối trung tính giúp nhiều phong cách component cùng xuất hiện mà không
  xung đột.

### Từ khóa

`precise` · `curated` · `dark neutral` · `technical` · `interactive` · `calm`

### Ngôn ngữ thị giác

- Canvas gần đen, hơi lạnh.
- Surface tăng sáng nhẹ theo hierarchy.
- Brand xanh lá đậm dùng cho primary action và trạng thái active.
- Mint sáng dùng cho link, focus, indicator và interaction highlight.
- Glow chỉ xuất hiện ở hero, focus hoặc vùng preview; không dùng đại trà.
- Corner radius vừa phải, không quá corporate và không quá playful.

## 4. Kiến trúc token

Token được chia thành ba lớp:

1. **Raw value:** chỉ tồn tại trong file token gốc.
2. **Semantic token:** được catalog CSS sử dụng trực tiếp.
3. **Tailwind bridge:** ánh xạ semantic token sang utility hiện tại.

Không tham chiếu raw value từ `index.html`, `component.html` hoặc các selector
component trong `main.css`.

## 5. Color tokens

### 5.1 Brand và interaction

```css
:root {
  --brand-primary: oklch(40% 0.14 160);
  --brand-primary-hover: oklch(46% 0.14 160);
  --brand-primary-active: oklch(35% 0.13 160);
  --brand-primary-subtle: oklch(20% 0.04 160);
  --brand-primary-text: #ffffff;

  --interaction-accent: #78ffd6;
  --interaction-accent-hover: #a8ff78;
  --interaction-accent-subtle: rgb(120 255 214 / 0.1);
  --focus-ring: #78ffd6;
}
```

Quy tắc:

- `--brand-primary` chỉ dùng cho background của primary action hoặc active item.
- Text trên brand background luôn dùng `--brand-primary-text`.
- Không dùng `--brand-primary` làm text trên canvas tối.
- Link, focus ring và small highlight dùng `--interaction-accent`.

### 5.2 Surface

```css
:root {
  --surface-base: #08090c;
  --surface-subtle: #111318;
  --surface-raised: #171a20;
  --surface-overlay: #1c2027;
  --surface-inset: #0d0f13;
  --surface-dialog: #171a20;
  --overlay-backdrop: rgb(0 0 0 / 0.72);
}
```

Thứ tự elevation:

```text
base → subtle → raised → overlay/dialog
```

Không tạo elevation chỉ bằng shadow. Surface, border và shadow phải phối hợp.

### 5.3 Text

```css
:root {
  --text-primary: #f6f7f9;
  --text-secondary: #aab0bc;
  --text-tertiary: #7b8290;
  --text-disabled: #5f6672;
  --text-inverse: #ffffff;
  --text-link: #78ffd6;
  --text-link-hover: #a8ff78;
}
```

Quy tắc:

- Heading và body chính: `--text-primary`.
- Description, helper text: `--text-secondary`.
- Metadata, timestamp, placeholder: `--text-tertiary`.
- Không dùng `--text-disabled` cho thông tin cần đọc.

### 5.4 Border

```css
:root {
  --border-subtle: rgb(255 255 255 / 0.06);
  --border-default: #2a2e37;
  --border-strong: #3b414c;
  --border-brand: oklch(55% 0.12 160);
  --border-focus: #78ffd6;
}
```

Border không được là tín hiệu focus duy nhất nếu contrast dưới `3:1`.

### 5.5 Status

Status token thể hiện ý nghĩa chung, không chứa mapping nghiệp vụ cụ thể.

```css
:root {
  --status-success-bg: #0d2a1a;
  --status-success-fg: #9cebb7;
  --status-success-border: #256b42;
  --status-success-icon: #5cdb8b;

  --status-warning-bg: #2a210d;
  --status-warning-fg: #f5d47a;
  --status-warning-border: #7c6224;
  --status-warning-icon: #f0b84b;

  --status-danger-bg: #2e1518;
  --status-danger-fg: #ffb3ba;
  --status-danger-border: #7f3139;
  --status-danger-icon: #ff6b78;

  --status-info-bg: #10243a;
  --status-info-fg: #a8d3ff;
  --status-info-border: #2f6094;
  --status-info-icon: #63aaff;

  --status-neutral-bg: #1a1d23;
  --status-neutral-fg: #c5c9d1;
  --status-neutral-border: #3b414c;
  --status-neutral-icon: #9399a6;
}
```

Intent:

| Semantic | Sử dụng |
|---|---|
| `success` | Hoàn tất, hợp lệ, sẵn sàng |
| `warning` | Cần chú ý, đang chờ, trạng thái trung gian |
| `danger` | Lỗi, destructive action, không khả dụng |
| `info` | Thông tin, hướng dẫn, readonly state |
| `neutral` | Metadata, draft, trạng thái không nhấn mạnh |

### 5.6 Contrast baseline đã kiểm tra

| Cặp màu | Contrast |
|---|---:|
| `brand-primary-text` / `brand-primary` | `8.18:1` |
| `brand-primary-text` / `brand-primary-hover` | `6.38:1` |
| `text-primary` / `surface-base` | `18.57:1` |
| `text-secondary` / `surface-base` | `9.15:1` |
| `text-tertiary` / `surface-base` | `5.16:1` |
| `text-link` / `surface-base` | `16.19:1` |
| `status-success-fg` / `status-success-bg` | `10.99:1` |
| `status-warning-fg` / `status-warning-bg` | `11.03:1` |
| `status-danger-fg` / `status-danger-bg` | `10.03:1` |
| `status-info-fg` / `status-info-bg` | `10.05:1` |
| `status-neutral-fg` / `status-neutral-bg` | `10.17:1` |

Contrast phải được kiểm tra lại khi bất kỳ token nào thay đổi.

## 6. Typography

### Font family

```css
:root {
  --font-body: "Inter", "Segoe UI", system-ui, sans-serif;
  --font-display: "Inter", "Segoe UI", system-ui, sans-serif;
  --font-mono: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
}
```

- `--font-body`: navigation, heading, body, label, button.
- `--font-mono`: version, code, technical metadata và keyboard shortcut.
- Không dùng quá hai font family trong catalog.

### Type scale

```css
:root {
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-display: clamp(2.5rem, 6vw, 3.75rem);

  --leading-tight: 1.05;
  --leading-heading: 1.15;
  --leading-body: 1.6;
  --leading-code: 1.75;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
}
```

Quy tắc:

- Display heading dùng negative letter spacing tối đa `-0.045em`.
- Body text không nhỏ hơn `1rem` ở nội dung dài.
- Label uppercase phải ngắn và tăng letter spacing; không dùng cho câu dài.
- Line length lý tưởng của body copy: `55–75` ký tự.

## 7. Spacing và layout

### Spacing scale

```css
:root {
  --space-px: 1px;
  --space-0-5: 0.125rem;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
}
```

- Custom CSS dùng spacing token.
- Tailwind spacing utility được phép nếu tuân theo cùng base scale `4px`.
- Không thêm giá trị spacing tùy ý nếu scale hiện tại đã đáp ứng được.

### Layout tokens

```css
:root {
  --content-max-width: 80rem;
  --reading-max-width: 48rem;
  --detail-sidebar-width: 22rem;
  --header-min-height: 4.5rem;
  --page-padding-mobile: 1.25rem;
  --page-padding-desktop: 2rem;
  --section-gap: 3rem;
  --card-padding: 1.25rem;
  --preview-min-height: 30rem;
}
```

Grid catalog:

- Mobile: `1` column.
- Medium viewport: `2` columns.
- Wide viewport: tối đa `3` columns.
- Card preview dùng aspect ratio thống nhất `16 / 10`.

## 8. Radius, elevation và z-index

### Radius

```css
:root {
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.25rem;
  --radius-full: 999px;
}
```

- Button/input: `--radius-lg`.
- Panel/card: `--radius-xl` hoặc `--radius-2xl`.
- Badge/tag: `--radius-full`.

### Elevation

```css
:root {
  --shadow-card: 0 18px 60px rgb(0 0 0 / 0.2);
  --shadow-raised: 0 24px 80px rgb(0 0 0 / 0.32);
  --shadow-focus: 0 0 0 4px rgb(120 255 214 / 0.12);
}
```

### Z-index

```css
:root {
  --z-base: 0;
  --z-header: 100;
  --z-dropdown: 200;
  --z-tooltip: 300;
  --z-dialog: 400;
  --z-toast: 500;
}
```

Không tự tạo z-index ngoài stack nếu chưa cập nhật tài liệu này.

## 9. Motion

```css
:root {
  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --duration-slow: 320ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

Quy tắc:

- Hover/focus feedback: `120–180ms`.
- Panel hoặc page transition: tối đa `320ms`.
- Không animate thuộc tính gây layout shift khi có thể dùng `transform` và
  `opacity`.
- Không autoplay animation mang tính trang trí khi người dùng yêu cầu reduced
  motion.
- Component preview có motion policy riêng trong `components/<id>/DESIGN.md`.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 10. Interaction patterns

### Primary button

- Background: `--brand-primary`.
- Text: `--brand-primary-text`.
- Hover: `--brand-primary-hover`.
- Active: `--brand-primary-active`.
- Focus: `--focus-ring` và `--shadow-focus`.
- Disabled: giảm emphasis nhưng label vẫn đọc được.

### Secondary button

- Background: transparent hoặc `--surface-subtle`.
- Border: `--border-default`.
- Text: `--text-secondary`.
- Hover: `--surface-overlay` và `--text-primary`.

### Search input

- Input phải có visible label hoặc accessible name.
- Search shortcut `/` chỉ hoạt động khi focus không nằm trong input/textarea.
- Focus state không được làm layout dịch chuyển.
- Empty query trả về toàn bộ component.

### Card

- Toàn card có thể click khi chỉ có một destination chính.
- Hover không vượt quá `translateY(-3px)`.
- Preview media phải có fallback.
- Description giới hạn số dòng nhưng accessible name không được mất.

### Badge và tag

- Category/tag dùng neutral appearance.
- Status badge dùng đúng nhóm `--status-*`.
- Badge phải có text; không dùng color dot đơn lẻ.

### Preview iframe

- Catalog không inject token hoặc reset CSS vào iframe.
- Preview phải có title mô tả component và variant.
- Loading/error state phải có fallback.
- Component không được truy cập hoặc thay đổi DOM của catalog.

## 11. Responsive behavior

- Thiết kế mobile-first từ `320px`.
- Interactive target tối thiểu `44 × 44px` khi thao tác chính trên touch.
- Detail layout chuyển từ một cột sang preview/sidebar ở wide viewport.
- Variant controls được wrap, không overflow theo chiều ngang.
- Typography display dùng `clamp()`, không dùng fixed size cho mọi viewport.
- Không ẩn thông tin bắt buộc chỉ để vừa màn hình.

## 12. Tailwind integration

Semantic token là interface; Tailwind utility chỉ là lớp tiện dụng.

```css
@import "tailwindcss" source(none);

@theme inline {
  --color-canvas: var(--surface-base);
  --color-surface: var(--surface-subtle);
  --color-surface-raised: var(--surface-raised);
  --color-line: var(--border-default);
  --color-ink: var(--text-primary);
  --color-muted: var(--text-secondary);
  --color-accent: var(--interaction-accent);
  --color-brand: var(--brand-primary);

  --font-sans: var(--font-body);
  --font-mono: var(--font-mono);
}
```

Quy tắc:

- Không dùng `@apply` trong file token.
- Không tạo Tailwind class bằng string interpolation.
- Không scan `components/` khi compile Tailwind cho catalog.
- Không dùng Tailwind utility để vượt qua semantic role, ví dụ
  `text-green-500` thay cho `text-link` hoặc status token.

## 13. Component-specific DESIGN.md

Mỗi component thật phải có `components/<id>/DESIGN.md` với tối thiểu:

1. Mục tiêu và use case.
2. Visual direction.
3. Variant list.
4. Component-owned tokens và default values.
5. Hover, focus, active, disabled, loading và error states phù hợp.
6. Motion behavior và reduced-motion fallback.
7. Responsive behavior.
8. Accessibility notes.
9. Dependencies và browser limitations.

Component có thể dùng convention semantic token giống catalog, nhưng phải tự
định nghĩa token trong package của nó.

## 14. Anti-patterns

```css
/* Sai: brand tối làm text trên canvas tối */
color: var(--brand-primary);

/* Đúng */
color: var(--text-link);
```

```css
/* Sai: raw value trong component selector */
.component-card {
  background: #111318;
  padding: 20px;
}

/* Đúng */
.component-card {
  background: var(--surface-subtle);
  padding: var(--card-padding);
}
```

```css
/* Sai: component preview phụ thuộc catalog */
@import "../../../catalog/styles/main.css";

/* Đúng: component tự chứa style và token */
@import "./component-tokens.css";
```

## 15. Governance và done gate

Thay đổi design system phải:

1. Cập nhật token/documentation trước hoặc cùng lúc với implementation.
2. Không thay đổi semantic meaning của token mà không đổi tên hoặc ghi migration.
3. Kiểm tra contrast tự động.
4. Kiểm tra keyboard focus và reduced motion.
5. Verify cả `index.html` và `component.html`.
6. Không làm component preview phụ thuộc catalog theme.
7. Chạy:

```powershell
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run verify
```

Các thay đổi lớn về palette, typography hoặc spacing phải tăng version của
design system trong đầu tài liệu này.
