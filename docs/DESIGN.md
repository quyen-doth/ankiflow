# AnkiFlow — Design System v2.0

> **Knowledge in Flow** — 1 つの単語を Anki カード一式に変える、静かで速いツールのためのビジュアル言語。
> リデザインの方向性: *ニュートラル & ミニマルな基盤、自信に満ちたブランドグリーン 1 色、温かみのあるアンバーのスパーク。*
> 対象: 単一のテクニカルパワーユーザー。Desktop-first。Local-first。

---

## 1. デザイン原則

| 原則 | 実践における意味 |
|---|---|
| **Calm over clever** | ニュートラルなキャンバス、余裕のあるスペーシング、意味のない装飾はしない。コンテンツこそがインターフェース。 |
| **One clear action** | 各画面には明確なプライマリーグリーンボタンが 1 つだけ。それ以外はすべてニュートラルで静かに保つ。 |
| **Built for speed** | Monospace メタデータ、可視化されたキーボードショートカット (`⌘N`、`⌘↵`、`/`)、密度の高いテーブル、オンボーディングの余計な演出なし。 |

これらは監査で指摘された問題を直接解決する: 弱い階層構造、低いコントラスト、色あせた色使い。

---

## 2. Color

以前の温かみのあるクリーム系パレットは **クールなニュートラル基盤** に置き換えられ、コンテンツが際立つようにしている。**元のブランドグリーンはプライマリーアクセントとして維持**し、**新しいアンバー**をセカンダリーのスパークとして追加。

### Brand — Green (primary accent)
| Token | Hex | 用途 |
|---|---|---|
| Green 900 | `#23492F` | Pressed / ライト背景上の最も濃いテキスト |
| **Green 700 ★** | **`#316342`** | **プライマリーボタン、active nav、ブランド、リンク、アイコン、progress** |
| Green 600 | `#3A7350` | primary の Hover state |
| Green 100 | `#D8E6DD` | green surfaces 上の Borders |
| Green 50 | `#F1F7F3` | ティント背景、"connected" pill |

### Spark — Amber (secondary accent · 新規)
| Token | Hex | 用途 |
|---|---|---|
| Amber 800 | `#8A5810` | amber tint 上のテキスト |
| **Amber 600 ★** | **`#B87514`** | **"Today" stat、tips、pending state、JA tag、secondary highlights** |
| Amber 400 | `#D99A3A` | Decorative / charts |
| Amber 100 | `#EFE0C6` | amber surfaces 上の Borders |
| Amber 50 | `#FAF3E6` | ティント callout 背景、Preview のライブ study-card surface |

### Neutrals — cool gray foundation
| Token | Hex | 用途 |
|---|---|---|
| Ink | `#15171C` | プライマリーテキスト、dark fills |
| Slate 600 | `#5C606A` | Body / secondary テキスト |
| Slate 400 | `#9396A0` | Muted labels、meta |
| Border | `#E8E8E3` | Card & table borders |
| Surface | `#FBFBFA` | Sidebar、raised rows |
| Canvas | `#F4F4F2` | App background |

**Color rule。** Green はアイデンティティ、ナビゲーション、そして唯一のプライマリーアクションを担う。Amber は *スパーク & 温かみ* — today/tips/pending/language tags と Preview のライブ study-card surface — だが、決してメイン CTA にはならない。Status: green = synced/success、amber = pending、`#C0392B` = destructive のみ。

---

## 3. Typography

2 つのファミリー、両方とも無料 (Google Fonts):

- **Hanken Grotesk** — UI、headings、body。クリーンで少し温かみのある grotesque。
- **JetBrains Mono** — labels、metadata、deck paths、IPA readings、code、shortcuts。

| Role | Size / weight | Notes |
|---|---|---|
| Page title | 24 / 800 | `letter-spacing:-0.02em` |
| Card / section heading | 15 / 800 | |
| Body | 14 / 500 | |
| Secondary / helper | 12.5 / 400 | Slate 400 |
| Overline label | 11 / 700, `0.05em`, UPPERCASE | JetBrains Mono, Slate 400 |
| Metadata / mono | 12–13 / 500 | JetBrains Mono |

> 旧タイプスケールが適用されず、headings が 16px でレンダリングされていた — これが "コンテンツが色あせて見える" の根本原因だった。v2 では全レベルに明示的な sizes/weights を設定。

---

## 4. Logo

マークは **折り目のある積み重なったカード** (`gallery-vertical-end`) — フラッシュカードがめくれる瞬間を表現。ワードマーク "AnkiFlow" (Hanken 800) + overline "KNOWLEDGE IN FLOW" (JetBrains Mono)。

- Default: **Green 700** の角丸タイル (`border-radius:10–13px`) 上に白いアイコン。
- 許可されるバリエーション: green-on-tint、white-on-ink。それ以外の再配色や引き伸ばしは不可。

---

## 5. Components

| Component | Spec |
|---|---|
| **Primary button** | Green 700 bg、白テキスト、radius 9、`box-shadow:0 2px 6px rgba(49,99,66,.22)`、hover は Green 600 |
| **Secondary button** | 白 bg、`#E3E3DE` border、Slate 600 テキスト |
| **Ghost button** | Green テキスト、fill なし |
| **Danger button** | `#FBF0EF` bg、`#C0392B` テキスト |
| **Input** | Height 42–46、radius 9、bg `#FCFCFB`、border `#E3E3DE`; focus = Green 700 border + 3px green ring |
| **Status pill** | ティント bg + 対応する dot、radius 999 (Synced=green、Pending=amber) |
| **Language tag** | ティント square 上に Mono 10px、radius 5 (EN=green、JA=amber) |
| **Toggle** | 42×24 track、20px knob; on=Green 700、off=`#DCDCD7` |
| **Card / panel** | 白、border `#E8E8E3`、radius 14、padding 20–24 |
| **Nav item (active)** | Green-tint bg + 3px left indicator bar + Green 700 テキスト |

---

## 6. Radius, elevation & icons

- **Radius:** 7 (controls) · 9 (buttons/inputs) · 14 (cards) · 999 (pills)。
- **Elevation:** flat (border のみ) → button shadow → modal shadow `0 24px 60px rgba(0,0,0,.18)`。
- **Icons:** Lucide、2px stroke、隣接テキストに合わせたサイズ。state を持つ場合のみ green/amber でティント。

---

## 7. App structure (screens)

| Screen | Purpose | Key states |
|---|---|---|
| **Dashboard** | ライブラリスナップショット — stats、recent、language breakdown、tip | — |
| **Create Card** | 単一エントリー → AI エンリッチ。タブ: Language / IT & Dev / General | Duplicate-found modal |
| **Preview** | 生成されたコンテンツをレビュー (hero-word hierarchy)、warm amber surface 上のライブカードプレビュー、card types を選択、deck を選ぶ | Card flip、type toggles |
| **History** | 作成されたカードのテーブル + detail drawer | Detail drawer、status filter |
| **Admin** | Categories / Card Types / Topics / Decks / Content Types 用 CMS | Tab switching |
| **Settings** | Integrations + AI + preferences | Toggles、save |
| **Design System** | この生きたスタイルガイド、アプリ内 | — |

永続的なシェル: 固定 248px の左 **sidebar** (logo、nav、Anki-connection status、user) + 固定 **top header** (breadcrumb/title + primary action)。

---

## 8. Files

すべての画面は共有のナビゲート可能な sidebar を持つインタラクティブな HTML プロトタイプ:

```
AnkiFlow Dashboard.dc.html       ← entry point
AnkiFlow Design System.dc.html   ← living style guide
AnkiFlow Create.dc.html          ← + duplicate modal
AnkiFlow Preview.dc.html
AnkiFlow History.dc.html         ← + detail drawer
AnkiFlow Admin.dc.html
AnkiFlow Settings.dc.html
```

任意の sidebar item をクリックすると画面間を移動できる。

---

*AnkiFlow Design System v2.0 · Knowledge in Flow · 2026*
