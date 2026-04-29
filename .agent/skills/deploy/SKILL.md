---
name: deploy
description: >
  Chuẩn bị và thực hiện deploy ankiflow. Dùng khi: user đề cập @deploy,
  hỏi "ready to deploy chưa", muốn check trước khi push lên production,
  hoặc cần deploy checklist. KHÔNG tự deploy mà không có user xác nhận.
---

# Skill: Deploy

## Mục tiêu
Đảm bảo mỗi lần deploy là **có chủ đích** — đã check đủ điều kiện,
không có lỗi obvious, và user đã confirm.

---

## Bước 1 — Đọc context bắt buộc
1. `docs/tasks.md` — xác định những task nào đã Done, còn gì In Progress
2. Kiểm tra có task nào marked "blocking deploy" không

---

## Bước 2 — Pre-deploy checklist

Chạy theo thứ tự và báo cáo kết quả từng mục:

```
PRE-DEPLOY CHECKLIST
=====================
[ ] Build không có lỗi
    → Chạy: npm run build

[ ] Không có TypeScript error
    → Chạy: npx tsc --noEmit

[ ] Không có console.log debug còn sót
    → Tìm: grep -r "console.log" app/ components/

[ ] ENV variables đã đủ
    → So sánh .env.example với .env.production

[ ] API endpoints hoạt động đúng
    → Xem docs/API.md, test các endpoint quan trọng

[ ] Không có TODO/FIXME blocking
    → Tìm: grep -r "TODO\|FIXME" app/ --include="*.ts" --include="*.tsx"
```

---

## Bước 3 — Báo cáo trạng thái

```
📊 DEPLOY READINESS REPORT
===========================
✅ Build: OK
✅ TypeScript: OK
⚠️  Console.log: 2 chỗ còn sót (app/cards/page.tsx:14, components/Deck/index.tsx:8)
✅ ENV: OK
❌ TODO blocking: 1 (app/api/sync/route.ts:32 - "TODO: add rate limiting")

Kết luận: CHƯA SẴN SÀNG — cần fix 1 blocking issue
```

---

## Bước 4 — Chờ xác nhận

Nếu tất cả ✅:
> "Checklist pass. Bạn có muốn mình proceed deploy không?"

Nếu có ⚠️ hoặc ❌:
> "Có [N] vấn đề cần xem xét trước. Bạn muốn fix trước hay vẫn deploy?"

**KHÔNG tự deploy khi chưa có xác nhận rõ ràng từ user.**

---

## Bước 5 — Sau khi deploy
Đề xuất:
```
💡 Bạn có muốn mình update docs/tasks.md để đánh dấu những task đã shipped không?
```

---

## Quy tắc bắt buộc
- **KHÔNG** bỏ qua checklist dù user nói "deploy nhanh thôi"
- **KHÔNG** tự chạy lệnh deploy nếu chưa có xác nhận
- **PHẢI** list rõ những gì chưa pass — không che giấu warning
- Nếu có blocking issue → đề xuất fix trước, không push qua