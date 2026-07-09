---
name: update-docs
description: >
  Sync tài liệu trong docs/ sau khi code thay đổi. Dùng khi:
  user đề cập @update-docs, vừa thêm/sửa/xóa API endpoint,
  vừa tạo hoặc sửa component, thay đổi data model hoặc schema,
  cập nhật task status, hoặc thay đổi design system / convention.
  KHÔNG tự ý update docs mà không có sự thay đổi code thực sự.
---

# Skill: Update Docs

## Mục tiêu
Giữ cho `docs/` luôn là **source of truth** phản ánh đúng trạng thái hiện tại
của codebase — không thừa, không thiếu, không lỗi thời.

---

## Mapping: Thay đổi nào → Update file nào

| Loại thay đổi                          | File cần update              |
|----------------------------------------|------------------------------|
| Thêm / sửa / xóa API endpoint          | `docs/API.md`                |
| Tạo / sửa React component              | `docs/design/COMPONENT.md`   |
| Thay đổi design token, layout, theme   | `docs/design/DESIGN.md`      |
| Hoàn thành task hoặc thêm task mới     | `docs/tasks.md`              |
| Thay đổi business logic / scope lớn   | `docs/prd.md`                |

> **Nguyên tắc:** Chỉ update đúng file liên quan. Không chạm vào file khác.

---

## Quy trình thực hiện

### Bước 1 — Đọc & Phân tích
1. Đọc toàn bộ file docs liên quan đến thay đổi (theo mapping ở trên)
2. Đọc các file code đã thay đổi để hiểu rõ thay đổi là gì
3. Xác định: thêm mới / sửa / xóa / đổi tên?

### Bước 2 — Tạo Proposal (KHÔNG tự ghi ngay)
Tạo một **diff proposal** dưới dạng:

```
📋 DOCS UPDATE PROPOSAL
========================
File: docs/API.md

[THÊM MỚI]
### POST /api/cards
...nội dung đề xuất...

[SỬA]
Dòng cũ: GET /api/decks → trả về array
Dòng mới: GET /api/decks → trả về { data: Deck[], total: number }

[XÓA]
### DELETE /api/legacy-sync  ← endpoint này đã bị remove
```

### Bước 3 — Chờ xác nhận
**DỪNG LẠI** và hỏi user:
> "Bạn có muốn mình apply những thay đổi này vào `docs/API.md` không?"

Chỉ tiếp tục khi user xác nhận **"ok"** hoặc **"apply"**.

### Bước 4 — Apply & Báo cáo
1. Ghi thay đổi vào đúng file docs
2. Báo cáo ngắn gọn:
   ```
   ✅ Đã update: docs/API.md
   - Thêm: POST /api/cards
   - Sửa: response type của GET /api/decks
   - Xóa: DELETE /api/legacy-sync
   ```

---

## Quy tắc bắt buộc

- **KHÔNG** update `docs/prd.md` trừ khi user yêu cầu rõ ràng — file này là product decision, không phải technical spec
- **KHÔNG** xóa nội dung docs mà không quote lại cho user thấy trước
- **KHÔNG** rewrite toàn bộ file — chỉ surgical edit đúng phần liên quan
- **PHẢI** giữ nguyên format và heading structure hiện có của từng file
- Nếu không chắc thay đổi thuộc file nào → hỏi user trước khi làm

---

## Ví dụ trigger tự nhiên

- *"vừa thêm xong endpoint tạo card"* → update `docs/API.md`
- *"đã làm xong task số 3"* → update `docs/tasks.md`
- *"@update-docs"* → hỏi: thay đổi gì vừa xảy ra?
- *"component CardList đã refactor"* → update `docs/design/COMPONENT.md`