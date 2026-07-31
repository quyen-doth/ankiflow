# カードテンプレート仕様書 — AnkiFlow

| 項目 | 内容 |
| --- | --- |
| 文書ID | AF-CRD-001 |
| 版数 | 1.0 |
| 作成日 | 2026-07-31 |
| 最終更新日 | 2026-07-31 |
| 作成者 | [hong-quyen](https://github.com/quyen-doth) |
| ステータス | 運用中 |
| 関連文書 | AF-DB-001、AF-UI-001、AF-ARC-001 |

## 1. 本書の位置づけ

本書は、AnkiFlow が生成する Anki カードの構成を定義する。対象は、Anki 側に登録するノートタイプ、カード本文の組み立て方式、利用できるフィールドソース、および既定のテンプレートである。

実装は `lib/anki/model.ts`、`lib/anki/renderCard.ts`、`lib/anki/cardFieldSource.ts` にある。本書と実装が食い違う場合は実装を正とし、本書を改訂すること。

## 2. Anki ノートタイプ

AnkiFlow が Anki 側に作成するノートタイプは 1 種類だけである。カードの種類ごとにノートタイプを分けることはしない。

| 項目 | 値 |
| --- | --- |
| ノートタイプ名 | `AnkiFlow-Basic` |
| フィールド | `Front`、`Back` |
| カードテンプレート | `Card 1` のみ |
| 表面 | `{{Front}}` |
| 裏面 | `{{FrontSide}}<hr id="answer">{{Back}}` |

カードの見た目の違いは、ノートタイプではなく `Front` / `Back` に流し込む HTML の中身で表現する。この方式により、カードの種類を増やしても Anki 側のノートタイプは増えず、利用者のコレクションを汚さない。

## 3. レンダリング方式

カード本文は、Firestore の `card_types.template` が持つブロック配列から組み立てる。テンプレートの型は次のとおりである。

```ts
interface CardTemplate {
  front: CardFieldSource[]  // 1 要素以上
  back: CardFieldSource[]   // 1 要素以上
}
```

`renderSide()` が配列を順に評価し、値が空でないブロックだけを HTML 片に変換して連結する。結果は `<div class="front">…</div>` または `<div class="back">…</div>` で包む。全ブロックが空の場合は空文字列を返す。

したがって、フィールドが未入力であってもカードに空欄が残ることはない。

## 4. フィールドソース

### 4.1 組み込みフィールドソース

`BUILTIN_CARD_FIELD_SOURCES` に定義された 12 種類である。取得元は複数の候補を順に評価し、最初に見つかった空でない文字列を採用する。

| ソース | 表示名 | 取得元 (優先順) | 出力 HTML |
| --- | --- | --- | --- |
| `word` | Word / Term | `word` → `term` → `title` | `<div class="word">` |
| `reading` | Reading | `hiragana` → `pinyin` → `ipa` | `<div class="reading">` |
| `han_viet` | Sino-Vietnamese reading | `han_viet` | `<div class="han-viet">` |
| `meaning` | Meaning | `meaning_vi` → `definition` → `definition_vi` → `content` | `<div class="meaning">` |
| `word_type` | Word type | `word_type` → `word_type_vi` | `<span class="pos">` |
| `example` | Example | `example_sentence` → `example_usage` | `<div class="example">` |
| `example_blank` | Fill-in-blank | `example_sentence` の見出し語を伏字化 | `<div class="example">` |
| `translation` | Translation | `example_translation` | `<div class="translation">` |
| `collocations` | Collocations | `collocations` 配列 | `<ul class="collocations">` |
| `image` | Image | メディア同期後のファイル名 → `image_url` | `<div class="media"><img>` |
| `audio` | Audio | 単語音声のファイル名 | `[sound:…]` |
| `audio_example` | Example audio | 例文音声のファイル名 | `[sound:…]` |

`example_blank` は、例文中に現れる見出し語を大文字小文字を区別せず検索し、`<b class="cloze">______</b>` へ置換する。例文が存在しない場合は空、見出し語が特定できない場合は例文をそのまま出力する。

`image` は、`image_url` が `data:` スキームの場合を除外する。Anki のメディアフォルダへ保存済みのファイル名がある場合はそちらを優先する。

### 4.2 カスタムフィールドソース

`custom:<key>` の形式で、AI 出力プロファイルが生成した任意のフィールドを配置できる。`<key>` は `AI_OUTPUT_FIELD_KEY_PATTERN` を満たす小文字スネークケースでなければならず、満たさない値はテンプレートの検証時に拒否される。

値が文字列であればそのまま、文字列配列であれば改行で連結して出力する。それ以外の型は空として扱う。出力は `<div class="custom-field custom-<key>">` である。

表示名は、Content Type 側で設定したラベルを用いる。未設定の場合はキーのアンダースコアを空白へ置き換え、先頭を大文字化した文字列を用いる。

## 5. 既定テンプレート

`card_types` に固有のテンプレートが設定されていない場合、`code` に対応する既定テンプレートを用いる。

| `code` | 表面 | 裏面 |
| --- | --- | --- |
| `word_to_meaning` | `word`、`reading`、`han_viet` | `meaning`、`word_type`、`image`、`audio` |
| `meaning_to_word` | `meaning` | `word`、`reading`、`han_viet`、`audio` |
| `audio_to_word` | `audio` | `word`、`reading`、`han_viet`、`meaning` |
| `image_to_word` | `image` | `word`、`reading`、`han_viet`、`meaning`、`audio` |
| `fill_in_blank` | `example_blank` | `example`、`translation`、`word`、`audio` |
| `reading_to_word` | `reading` | `word`、`han_viet`、`meaning`、`audio` |
| `word_to_reading` | `word`、`han_viet` | `reading`、`meaning`、`audio` |
| `concept_to_def` | `word` | `meaning`、`example`、`translation`、`audio` |
| `def_to_concept` | `meaning` | `word`、`example`、`audio` |
| `front_to_back` | `word` | `meaning`、`example`、`translation`、`audio` |

### 5.1 テンプレートの解決順序

`resolveCardTemplate()` は次の順に判定する。Firestore に legacy データや破損データが残っていても、カード生成が失敗しないようにするためである。

1. `card_types.template` が存在し、スキーマ検証を通れば、それを用いる
2. 通らない場合、`code`（未設定なら文書 ID）に一致する既定テンプレートを用いる
3. いずれにも一致しない場合、`word_to_meaning` を用いる

`code` の照合には `Object.prototype.hasOwnProperty` を用いる。`constructor` などのプロトタイプ由来のキーを既定テンプレートとして誤って解決させないためである。

## 6. カード CSS

CSS は `ANKI_CARD_CSS` として一括で定義し、ノートタイプ作成時に Anki へ登録する。カードの種類ごとに CSS を分けることはしない。

| 項目 | 内容 |
| --- | --- |
| フォント | `Inter` を基本とし、CJK には `Noto Sans SC` / `Noto Sans JP` をフォールバックとして指定する |
| 読み仮名・ピンイン | 等幅フォント (`JetBrains Mono` → `Fira Code`) |
| 配置 | 中央寄せ、最大幅 560px |
| 例文 | 左寄せ、斜体。伏字部分 (`.cloze`) と強調部分は緑色かつ非斜体 |
| 画像 | 最大高さ 220px、`object-fit: contain` |
| ダークモード | `.nightMode` セレクタで文字色・背景色・区切り線を上書きする |

外部フォントの読み込みは行わない。利用者の端末に該当フォントが存在しない場合は、指定順のフォールバックが適用される。

## 7. プレビューとの差異

アプリのプレビュー画面は、Anki へ書き出すものと同じ `renderSide()` を用いる。差異は音声ブロックの扱いだけである。

| 出力先 | `audio` / `audio_example` の表現 |
| --- | --- |
| Anki | `[sound:ファイル名]` |
| プレビュー | `<span class="audio-chip">🔊 表示名</span>` |

プレビューで `[sound:…]` をそのまま表示しても再生できず、意味のない文字列になるためである。この切り替えは `RenderOpts.audioIcon` で制御する。

## 改訂履歴

| 版数 | 日付 | 変更内容 | 変更者 |
| --- | --- | --- | --- |
| 1.0 | 2026-07-31 | 初版作成。実装 (`lib/anki/`) を正として、ノートタイプ・レンダリング方式・フィールドソース・既定テンプレート・CSS を記述 | hong-quyen |
