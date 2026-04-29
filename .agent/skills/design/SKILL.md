---
name: design
description: >
  Tạo hoặc sửa UI component trong ankiflow theo đúng design system.
  Dùng khi: user đề cập @design, yêu cầu tạo component mới,
  sửa giao diện, hỏi về styling convention, hoặc implement UI từ mockup.
  KHÔNG dùng cho logic backend hoặc API.
---

# Skill: Design & Component

## Mục tiêu
Đảm bảo mọi component được tạo/sửa đều tuân thủ design system
đã định nghĩa trong `docs/design/` — không tự sáng tác style.

---

## Bước 1 — Đọc context bắt buộc
1. `docs/design/DESIGN.md` — design tokens, color, typography, spacing
2. `docs/design/COMPONENT.md` — danh sách component đã có, pattern đang dùng

> **Quan trọng:** Kiểm tra `COMPONENT.md` trước — component bạn cần có thể đã tồn tại.

---

## Bước 2 — Kiểm tra trùng lặp
Trước khi tạo component mới, tìm kiếm:
```
components/
app/**/components/
```
Nếu component tương tự đã có → đề xuất **reuse hoặc extend**, không tạo mới.

---

## Bước 3 — Tạo component đúng chuẩn

### Structure:
```tsx
// components/[ComponentName]/index.tsx

import { type FC } from 'react'

interface [ComponentName]Props {
  // props rõ ràng, có type
}

export const [ComponentName]: FC<[ComponentName]Props> = ({ ... }) => {
  return (
    // JSX
  )
}
```

### Styling rules (đọc từ DESIGN.md):
- Dùng đúng design token đã định nghĩa, không hardcode màu/spacing
- Nếu dùng Tailwind: chỉ dùng class đã có trong design system
- Nếu dùng CSS module: đặt file `[ComponentName].module.css` cùng folder

---

## Bước 4 — Sau khi tạo xong
Đề xuất:
```
✅ Đã tạo: components/[ComponentName]/index.tsx

💡 Bạn có muốn mình update docs/design/COMPONENT.md để đăng ký component này không?
```

---

## Quy tắc bắt buộc
- **KHÔNG** tạo component nếu chưa đọc `DESIGN.md` và `COMPONENT.md`
- **KHÔNG** dùng inline style trừ khi dynamic value
- **KHÔNG** tự đặt màu hoặc font ngoài design system
- **PHẢI** check component đã tồn tại trước khi tạo mới