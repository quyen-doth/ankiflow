# AnkiFlow — Design System v2.0

> **Cognitive Sanctuary** — the visual language for a calm, fast tool that turns a single word into a full set of Anki cards.
> Redesign direction: *neutral & minimal foundation, one confident brand green, a warm amber spark.*
> Audience: a single technical power-user. Desktop-first. Local-first.

---

## 1. Design principles

| Principle | What it means in practice |
|---|---|
| **Calm over clever** | Neutral canvas, generous spacing, no decoration without meaning. The content is the interface. |
| **One clear action** | Each screen has exactly one primary green button. Everything else stays quiet in neutral. |
| **Built for speed** | Monospace metadata, visible keyboard shortcuts (`⌘N`, `⌘↵`, `/`), dense tables, no onboarding fluff. |

These directly fix the audited problems: weak hierarchy, low contrast, and washed-out color.

---

## 2. Color

The previous warm-cream palette is replaced by a **cool neutral foundation** so content pops, with the **original brand green kept as the primary accent** and a **new amber** added as a secondary spark.

### Brand — Green (primary accent)
| Token | Hex | Use |
|---|---|---|
| Green 900 | `#23492F` | Pressed / deepest text on light |
| **Green 700 ★** | **`#316342`** | **Primary buttons, active nav, brand, links, icons, progress** |
| Green 600 | `#3A7350` | Hover state for primary |
| Green 100 | `#D8E6DD` | Borders on green surfaces |
| Green 50 | `#F1F7F3` | Tinted backgrounds, "connected" pill |

### Spark — Amber (secondary accent · new)
| Token | Hex | Use |
|---|---|---|
| Amber 800 | `#8A5810` | Text on amber tint |
| **Amber 600 ★** | **`#B87514`** | **"Today" stat, tips, pending state, JA tag, secondary highlights** |
| Amber 400 | `#D99A3A` | Decorative / charts |
| Amber 100 | `#EFE0C6` | Borders on amber surfaces |
| Amber 50 | `#FAF3E6` | Tinted callout backgrounds, live study-card surface (Preview) |

### Neutrals — cool gray foundation
| Token | Hex | Use |
|---|---|---|
| Ink | `#15171C` | Primary text, dark fills |
| Slate 600 | `#5C606A` | Body / secondary text |
| Slate 400 | `#9396A0` | Muted labels, meta |
| Border | `#E8E8E3` | Card & table borders |
| Surface | `#FBFBFA` | Sidebar, raised rows |
| Canvas | `#F4F4F2` | App background |

**Color rule.** Green carries identity, navigation and the single primary action. Amber is a *spark & warmth* — today/tips/pending/language tags and the live study-card surface in Preview — but never the main CTA. Status: green = synced/success, amber = pending, `#C0392B` = destructive only.

---

## 3. Typography

Two families, both free (Google Fonts):

- **Hanken Grotesk** — UI, headings, body. Clean, slightly warm grotesque.
- **JetBrains Mono** — labels, metadata, deck paths, IPA readings, code, shortcuts.

| Role | Size / weight | Notes |
|---|---|---|
| Page title | 24 / 800 | `letter-spacing:-0.02em` |
| Card / section heading | 15 / 800 | |
| Body | 14 / 500 | |
| Secondary / helper | 12.5 / 400 | Slate 400 |
| Overline label | 11 / 700, `0.05em`, UPPERCASE | JetBrains Mono, Slate 400 |
| Metadata / mono | 12–13 / 500 | JetBrains Mono |

> The old type scale failed to apply, so headings rendered at 16px — the root cause of "content looks washed out". v2 sets explicit sizes/weights on every level.

---

## 4. Logo

The mark is a **stacked card with a fold** (`gallery-vertical-end`) — a flashcard mid-flip. Wordmark "AnkiFlow" (Hanken 800) + overline "COGNITIVE SANCTUARY" (JetBrains Mono).

- Default: white icon on a **Green 700** rounded tile (`border-radius:10–13px`).
- Variants allowed: green-on-tint, white-on-ink. No other recoloring, no stretching.

---

## 5. Components

| Component | Spec |
|---|---|
| **Primary button** | Green 700 bg, white text, radius 9, `box-shadow:0 2px 6px rgba(49,99,66,.22)`, hover Green 600 |
| **Secondary button** | White bg, `#E3E3DE` border, Slate 600 text |
| **Ghost button** | Green text, no fill |
| **Danger button** | `#FBF0EF` bg, `#C0392B` text |
| **Input** | Height 42–46, radius 9, bg `#FCFCFB`, border `#E3E3DE`; focus = Green 700 border + 3px green ring |
| **Status pill** | Tinted bg + matching dot, radius 999 (Synced=green, Pending=amber) |
| **Language tag** | Mono 10px on tinted square, radius 5 (EN=green, JA=amber) |
| **Toggle** | 42×24 track, 20px knob; on=Green 700, off=`#DCDCD7` |
| **Card / panel** | White, border `#E8E8E3`, radius 14, padding 20–24 |
| **Nav item (active)** | Green-tint bg + 3px left indicator bar + Green 700 text |

---

## 6. Radius, elevation & icons

- **Radius:** 7 (controls) · 9 (buttons/inputs) · 14 (cards) · 999 (pills).
- **Elevation:** flat (border only) → button shadow → modal shadow `0 24px 60px rgba(0,0,0,.18)`.
- **Icons:** Lucide, 2px stroke, sized to adjacent text. Tinted green/amber only when carrying state.

---

## 7. App structure (screens)

| Screen | Purpose | Key states |
|---|---|---|
| **Dashboard** | Library snapshot — stats, recent, language breakdown, tip | — |
| **Create Card** | Single entry → AI enrich. Tabs: Language / IT & Dev / General | Duplicate-found modal |
| **Preview** | Review generated content (hero-word hierarchy), live card preview on warm amber surface, pick card types, choose deck | Card flip, type toggles |
| **History** | Table of created cards + detail drawer | Detail drawer, status filter |
| **Admin** | CMS for Categories / Card Types / Topics / Decks / Content Types | Tab switching |
| **Settings** | Integrations + AI + preferences | Toggles, save |
| **Design System** | This living style guide, in-app | — |

Persistent shell: fixed 248px left **sidebar** (logo, nav, Anki-connection status, user) + sticky **top header** (breadcrumb/title + primary action).

---

## 8. Files

All screens are interactive HTML prototypes with a shared, navigable sidebar:

```
AnkiFlow Dashboard.dc.html       ← entry point
AnkiFlow Design System.dc.html   ← living style guide
AnkiFlow Create.dc.html          ← + duplicate modal
AnkiFlow Preview.dc.html
AnkiFlow History.dc.html         ← + detail drawer
AnkiFlow Admin.dc.html
AnkiFlow Settings.dc.html
```

Click any sidebar item to move between screens.

---

*AnkiFlow Design System v2.0 · Cognitive Sanctuary · 2026*
