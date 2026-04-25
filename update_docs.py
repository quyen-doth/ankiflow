import re
import os

prd_path = "/Users/hong-quyen/.gemini/antigravity/brain/3b6e8052-b876-4f7f-aa24-345708ed957a/prd_anki_automation.md"
task_path = "/Users/hong-quyen/.gemini/antigravity/brain/3b6e8052-b876-4f7f-aa24-345708ed957a/task.md"

with open(prd_path, "r", encoding="utf-8") as f:
    prd = f.read()

# 1. Xóa "Cognitive Sanctuary"
prd = prd.replace("Cognitive Sanctuary\n", "")
prd = prd.replace("Cognitive Sanctuary", "AnkiFlow")

# 2. Cập nhật phần 8 - Admin UI
section_8_new = """## 8. 🎨 Admin UI — Design System & Component Architecture

### 8.1 Design System (Light Mode)

- **Phong cách:** Light mode, "Precision Clarity" — editorial, premium, tối giản.
- **Quy tắc "No-Line":** KHÔNG dùng border 1px cứng để phân tách section → chỉ dùng tonal shift (thay đổi màu nền).
- **Màu sắc (Tonal Architecture):**
  - `background`: `#f7f9fb` (Nền trang chính)
  - `surface-container`: `#eceef0` (Nền sidebar, hover area)
  - `surface-container-low`: `#f2f4f6` (Fixed sidebar background)
  - `surface-container-lowest`: `#ffffff` (Card nội bộ, input fields)
  - `primary`: `#0061a4` (CTA chính, link, icon highlight)
  - `secondary`: `#515f74` (Text phụ, metadata)
  - `on_surface`: `#191c1e` (Text chính)
  - `on_surface_variant`: `#404752` (Text phụ, muted)
- **Typography:** Inter cho tất cả (Headline, Body, Label).
- **Elevation:** Ambient shadow (blur 24-40px, 4-8% opacity) hoặc Glassmorphism (80% opacity + blur 12px) cho các floating elements.

### 8.2 Kiến trúc Component UI (Atomic Design)

Để đảm bảo tính nhất quán và dễ maintain, UI được chia thành các components tái sử dụng:

- **Atoms (Thành phần cơ bản):**
  - `Button`: Primary, Secondary, Ghost, Icon.
  - `Input`: TextField, TextArea, Checkbox.
  - `Badge/Chip`: Thể hiện status, level, word type (Pill shape 9999px).
  - `Avatar`: Hiển thị user profile.
- **Molecules (Thành phần ghép nối):**
  - `StatCard`: Hiển thị thống kê trên Dashboard (gồm icon, số liệu, text).
  - `FormField`: Label + Input + Error message.
  - `ApiStatusCard`: Hiển thị trạng thái kết nối API.
  - `EntryListItem`: Dòng hiển thị từ vựng trong danh sách.
- **Organisms (Thành phần phức hợp):**
  - `Sidebar`: Chứa logo, navigation links, user profile.
  - `PreviewPanel`: Vùng hiển thị review card và metadata trước khi tạo.
  - `HistoryTable`: Bảng danh sách lịch sử có phân trang và filter.
  - `AdminPanelTabs`: Tabs quản lý category, deck, card types.
- **Layouts:**
  - `MainLayout`: Sidebar cố định (280px) + Content area scroll mượt.

### 8.3 Danh sách màn hình & Luồng tương tác

| Màn hình | Route | Mô tả |
|---|---|---|
| Dashboard | `/` | Thống kê, activity gần đây |
| Tạo card mới | `/create` | Form nhập liệu chính |
| Preview & Review | `/preview` | Xem trước card trước khi tạo |
| Lịch sử | `/history` | Danh sách entries đã tạo |
| Chi tiết entry | `/history/[id]` | Xem chi tiết 1 entry |
| **Quản lý nội dung** | **`/admin`** | **CRUD categories, topics, card types, content types, decks** |
| Cài đặt | `/settings` | API keys, cấu hình hệ thống |

(Chi tiết luồng tương tác các trang xem thêm ở phiên bản trước - áp dụng thiết kế Light Mode và Tonal Architecture)
"""

prd = re.sub(r'## 8\. 🎨 Admin UI.*?## 9\. 🃏 Anki Card Templates', section_8_new + '\n## 9. 🃏 Anki Card Templates', prd, flags=re.DOTALL)

# 3. Cập nhật phần 9 - Light Mode CSS
css_old = r'''/\* === Biến CSS toàn cục === \*/
\.card \{
  --color-primary: #6366f1;       /\* Indigo \*/
  --color-primary-light: #818cf8;
  --color-accent: #f59e0b;        /\* Amber \*/
  --color-bg: #0f172a;            /\* Slate 900 — dark mode \*/
  --color-card-bg: #1e293b;       /\* Slate 800 \*/
  --color-card-border: #334155;   /\* Slate 700 \*/
  --color-text: #f1f5f9;          /\* Slate 100 \*/
  --color-text-muted: #94a3b8;    /\* Slate 400 \*/
  --color-success: #10b981;       /\* Emerald \*/
  --color-han-viet: #a78bfa;      /\* Violet \*/
  --color-example: #38bdf8;       /\* Sky \*/
  --color-collocation: #fb923c;   /\* Orange \*/
  --radius: 16px;
  --font-main: 'Inter', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans', 'Hiragino Sans', 'Microsoft YaHei', sans-serif;
\}'''

css_new = '''/* === Biến CSS toàn cục === */
.card {
  --color-primary: #0061a4;       /* Primary */
  --color-primary-light: #2196f3;
  --color-accent: #f59e0b;        /* Amber */
  --color-bg: #f7f9fb;            /* Light background */
  --color-card-bg: #ffffff;       /* Surface lowest */
  --color-card-border: transparent; /* No-line rule */
  --color-text: #191c1e;          /* On surface */
  --color-text-muted: #515f74;    /* Secondary */
  --color-success: #006c49;       /* Tertiary */
  --color-han-viet: #8b5cf6;      /* Violet */
  --color-example: #0284c7;       /* Sky */
  --color-collocation: #ea580c;   /* Orange */
  --radius: 12px;
  --font-main: 'Inter', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans', 'Hiragino Sans', 'Microsoft YaHei', sans-serif;
}'''

prd = re.sub(r'/\* === Biến CSS toàn cục === \*/\s*\.card \{[^}]+\}', css_new, prd)

# Cập nhật box shadow của card-container
shadow_old = r'box-shadow: 0 8px 32px rgba\(0, 0, 0, 0\.3\);'
shadow_new = r'box-shadow: 0 12px 32px rgba(25, 28, 30, 0.08);'
prd = re.sub(shadow_old, shadow_new, prd)


# Ghi ra file prd.md
with open("/Users/hong-quyen/Documents/study/flashcard/ankiflow/prd.md", "w", encoding="utf-8") as f:
    f.write(prd)

# Xử lý task.md
with open(task_path, "r", encoding="utf-8") as f:
    task = f.read()

task = task.replace("Cognitive Sanctuary", "AnkiFlow")

# Cập nhật CSS base mới (dark mode -> light mode)
task = task.replace("dark mode, gradient, font safety", "light mode, no-line rule, font safety")

# Ghi ra file tasks.md
with open("/Users/hong-quyen/Documents/study/flashcard/ankiflow/tasks.md", "w", encoding="utf-8") as f:
    f.write(task)

print("Done")
