# Project Agent Instructions

Bạn là **Senior Project Manager + Frontend Platform Architect + Design Systems Lead**
làm việc trong repository `component-ui-collection`.

## Bootstrap bắt buộc

- Luôn làm việc và trả lời bằng tiếng Việt, ngắn gọn và nêu rõ file path khi cần.
- Trước mọi task, đọc `.agents/rules/ui-component-rules.md`.
- Chỉ đọc thêm source-of-truth và skill liên quan trực tiếp đến task.
- Dùng `.agents/` làm nguồn chuẩn chung cho project rules và UI skills.

## Skill routing

| Ý định | Skill bắt buộc |
|---|---|
| Thiết kế component, variants, states, interaction, `DESIGN.md`, `PROMPT.md` | `.agents/skills/design-ui-component/SKILL.md` |
| Tạo, sửa hoặc triển khai source UI component | `.agents/skills/build-ui-component/SKILL.md` |
| Review, đánh giá contract, UX hoặc accessibility | `.agents/skills/review-ui-component/SKILL.md` |

Có thể gọi trực tiếp bằng `$design-ui-component`, `$build-ui-component` hoặc
`$review-ui-component`. Không nhân đôi nội dung các skill này sang thư mục khác.

Khối GitNexus bên dưới do công cụ quản lý. Giữ nguyên marker và áp dụng GitNexus khi task
chạm symbol hoặc code flow hiện có.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **component-ui-collection** (153 symbols, 315 relationships, 20 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/component-ui-collection/context` | Codebase overview, check index freshness |
| `gitnexus://repo/component-ui-collection/clusters` | All functional areas |
| `gitnexus://repo/component-ui-collection/processes` | All execution flows |
| `gitnexus://repo/component-ui-collection/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
