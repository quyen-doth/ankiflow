# Prompt Template — AnkiFlow Task Runner

## Biến được inject bởi task-runner.sh

# {{TASK_ID}} — số thứ tự task

# {{TASK_TITLE}} — tiêu đề task

# {{TASK_CATEGORY}} — category (UI/UX, Bug Fix, v.v.)

# {{TASK_DETAIL}} — yêu cầu chi tiết (bullet points)

# {{BRANCH_NAME}} — tên branch được tạo tự động

---

## Template nội dung prompt

```
Bạn đang thực hiện task #{{TASK_ID}} trong dự án AnkiFlow.

## Thông tin task
- Tiêu đề: {{TASK_TITLE}}
- Category: {{TASK_CATEGORY}}
- Nhánh làm việc: {{BRANCH_NAME}}

## Yêu cầu chi tiết
{{TASK_DETAIL}}

## Quy trình bắt buộc (theo CLAUDE.md)
Thực hiện ĐÚNG THỨ TỰ các bước sau, KHÔNG bỏ qua bước nào:

1. **Đọc & Hiểu** — Đọc các file docs/ liên quan trước khi chạm vào code.
2. **Lập kế hoạch** — Liệt kê rõ: file nào thay đổi, tại sao, kết quả mong đợi.
3. **Thực thi** — Chỉ implement đúng những gì đã lên kế hoạch.
4. **Self-review** — Kiểm tra diff, đảm bảo không có file ngoài scope bị chỉnh.
5. **Viết test** — Viết Vitest unit test trong verify/, chạy `npm run verify` — tất cả phải pass.
6. **Cập nhật docs** — Cập nhật docs/API.md hoặc docs/DATABASE.md nếu có thay đổi liên quan.
7. **Báo cáo** — Tóm tắt: file đã thay đổi, kết quả test, giới hạn đã biết.

## Ràng buộc
- KHÔNG xóa Firestore documents hoặc Anki notes khi không có lệnh rõ ràng.
- KHÔNG chỉnh sửa file trong docs/ mà không có xác nhận.
- KHÔNG gọi Firestore trong vòng lặp — dùng Promise.all().
- TypeScript strict mode — không dùng `any`.
- Tất cả UI text phải bằng tiếng Anh.

## Khi hoàn thành
Kết thúc output bằng block JSON sau (để task-runner.sh parse):

TASK_RESULT_JSON
{
  "status": "done|failed",
  "files_changed": ["path/to/file1", "path/to/file2"],
  "tests_passed": true|false,
  "summary": "Mô tả ngắn những gì đã làm",
  "limitations": "Ghi chú giới hạn nếu có, hoặc none"
}
END_TASK_RESULT_JSON
```
