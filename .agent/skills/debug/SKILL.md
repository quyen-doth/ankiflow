---
name: debug
description: >
  Debug và fix lỗi trong ankiflow. Dùng khi: user đề cập @debug,
  paste error message, mô tả behavior bất thường, hỏi "tại sao X không chạy",
  hoặc có unexpected output. Ưu tiên tìm root cause trước khi fix.
---

# Skill: Debug & Fix

## Mục tiêu
Tìm **root cause** — không patch symptom. Mọi fix đều có giải thích
tại sao lỗi xảy ra và cách fix giải quyết nó.

---

## Bước 1 — Thu thập thông tin
Nếu user chưa cung cấp đủ, hỏi:
1. Error message đầy đủ là gì? (kể cả stack trace)
2. Lỗi xảy ra ở đâu? (browser / terminal / build time / runtime)
3. Lỗi xuất hiện lần đầu sau thay đổi gì?

> Không bắt đầu debug nếu chưa có ít nhất error message hoặc mô tả behavior.

---

## Bước 2 — Đọc multi-file context
Đọc theo thứ tự:
1. File báo lỗi (file trong stack trace)
2. File import/dependency liên quan
3. Nếu lỗi API → đọc `docs/API.md` để check contract
4. Nếu lỗi UI → đọc `docs/design/COMPONENT.md`

---

## Bước 3 — Phân tích root cause

Trình bày rõ ràng:
```
🔍 ROOT CAUSE
─────────────
[Giải thích ngắn gọn TẠI SAO lỗi xảy ra]

📍 VỊ TRÍ
─────────
File: [path]
Dòng: [số dòng nếu biết]

🧩 LIÊN QUAN
─────────────
[File/component nào bị ảnh hưởng]
```

---

## Bước 4 — Đề xuất fix

Luôn đưa ra **diff rõ ràng**:
```
TRƯỚC:
[code cũ]

SAU:
[code đề xuất]

LÝ DO:
[giải thích tại sao fix này đúng]
```

Nếu có nhiều cách fix → liệt kê trade-off, đề xuất 1 cách tốt nhất.

---

## Bước 5 — Verify sau khi fix
Đề xuất cách test:
```
✅ Để verify fix này, thử:
1. [bước test cụ thể]
2. Expected result: [...]
```

---

## Quy tắc bắt buộc
- **KHÔNG** fix code nếu chưa hiểu root cause
- **KHÔNG** thay đổi nhiều file cùng lúc trừ khi chắc chắn liên quan
- **KHÔNG** xóa code "có vẻ không dùng" trong khi debug — scope riêng
- **PHẢI** giải thích fix, không chỉ đưa code mới

---

## Common patterns trong Next.js + Fastify

```
Lỗi hydration      → check server/client state mismatch
Lỗi CORS           → check Fastify cors plugin config
Type error TS      → check interface mismatch giữa API response và frontend type
404 API route      → check file naming: phải là route.ts, không phải index.ts
ENV not found      → check .env.local vs .env, và NEXT_PUBLIC_ prefix
```