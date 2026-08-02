# AI プロンプト仕様書 — AnkiFlow

| 項目 | 内容 |
| --- | --- |
| 文書ID | AF-PRM-001 |
| 版数 | 1.0 |
| 作成日 | 2026-07-31 |
| 最終更新日 | 2026-07-31 |
| 作成者 | [hong-quyen](https://github.com/quyen-doth) |
| ステータス | 運用中 |
| 関連文書 | AF-API-001、AF-DB-001、AF-CRD-001 |

## 1. 本書の位置づけ

本書は、Claude API を用いたカード内容の自動生成における、プロンプトと出力スキーマの構築方式を定義する。

AnkiFlow はプロンプトを言語ごとにハードコードしない。Content Type ごとに保存された「AI 出力プロファイル」から、プロンプト・出力スキーマ・ツール定義を実行時に組み立てる。この方式により、利用者は管理画面から生成内容を変更でき、コードの変更もデプロイも不要である。

実装は `lib/ai-agent/promptEngine.ts`、`lib/ai-agent/outputProfiles.ts`、`lib/ai-agent/languageProfiles.ts`、`lib/ai-agent/card-spec.ts` にある。本書と実装が食い違う場合は実装を正とし、本書を改訂すること。

## 2. 生成の全体像

```
Content Type の定義 (Firestore)
   ├─ primary_field_key
   ├─ ai_output_profiles[]
   └─ field_labels
        │
        ▼
buildEngineCardSpec()          ← 学習言語・出力言語・入力値を受け取る
   ├─ プロファイルを選択し、継承を解決する
   ├─ 出力言語で対象フィールドを絞り込む
   ├─ Zod スキーマを構築する
   ├─ system prompt / user message を構築する
   └─ Anthropic ツール入力スキーマへ変換する
        │
        ▼
CardSpec { toolName, toolDescription, systemPrompt, userMessage, schema, inputSchema }
        │
        ▼
Claude API (tool use) → submit_card ツールの引数として構造化データを受け取る
```

生成結果は自由文ではなく、必ず `submit_card` ツールの引数として受け取る。出力形式の逸脱を型で防ぐためである。

## 3. AI 出力プロファイル

### 3.1 フィールドの定義

| 項目 | 型 | 制約 |
| --- | --- | --- |
| `key` | string | 小文字スネークケース、先頭は英字、40 文字以内 |
| `type` | enum | `string` または `string_array` |
| `label` | string | 任意。1〜60 文字。プレビューとカードでの表示名 |
| `instruction` | string | 1〜300 文字。スキーマの field description としてモデルへ渡す |
| `include_when` | enum | 任意。`always` (既定) または `output_vi` |
| `max_items` | number | 任意。1〜20。`string_array` のときのみ指定できる |

`max_items` を省略した場合は 10 を用いる。`type` が `string` のときに `max_items` を指定すると検証で拒否する。

### 3.2 予約キー

アプリケーションが管理する Entry のフィールドと衝突するキーは使用できない。`id`、`user_id`、`form_type`、`language`、`output_language`、`category_id`、`anki_deck`、`anki_note_ids`、`card_type_ids`、`topic_ids`、`tags`、`status`、`created_at`、`updated_at` などが該当する。クエリ用の予約接頭辞を持つキーも同様に拒否する。

### 3.3 上限値

| 項目 | 上限 |
| --- | --- |
| 1 プロファイルあたりのフィールド数 | 30 |
| Content Type あたりのプロファイル数 | 20 |
| `string_array` の要素数 | 20 |

## 4. プロファイルの選択と継承

### 4.1 選択

プロファイルのキーは `default`、または BCP 47 の primary subtag (`en`、`zh`、`ja` など) である。学習言語の primary subtag と同名のプロファイルを優先し、存在しなければ `default` を用いる。`default` が存在しない定義は不正であり、実行時に例外となる。

### 4.2 継承

`default` 以外のプロファイルは `default` のフィールドを継承できる。実効フィールドは次の順序で構成する。

1. 当該プロファイル自身のフィールド (定義順)
2. `default` のフィールドのうち、同名キーを自身が持たず、かつ `exclude` に含まれないもの

`default` プロファイル自身は `inherit` も `exclude` も持てない。継承元が存在しないためである。

### 4.3 legacy プロファイルの正規化

`inherit` を持たない旧形式のプロファイルは、読み込み時に `inherit: true` と、`default` にあって自身にないキーをすべて列挙した `exclude` へ変換する。結果として、旧形式のプロファイルは移行前とまったく同じフィールド集合を保つ。

また `exclude` は、`default` に実在するキーだけを残すよう正規化する。これを行わないと、`default` からフィールドを削除して同じキーを再追加した際に古い `exclude` が生き残り、追加したばかりのフィールドが黙って継承されなくなる。

## 5. 出力言語によるフィールドの絞り込み

`include_when` が `output_vi` のフィールドは、出力言語の primary subtag が `vi` の場合にだけスキーマへ含める。ベトナム語話者に固有の概念である漢越音 (`han_viet`) などが該当し、他言語の利用者には生成も表示も行わない。

絞り込みの結果、Content Type の `primary_field_key` がスキーマから失われた場合は、不正な設定として例外を送出する。主フィールドを欠いたカードは生成しても意味を持たないためである。

## 6. プロンプトの構築

### 6.1 システムプロンプト

```
You are an expert in {専門分野}, creating study content for {出力言語} speakers.
Content type focus: {Content Type の説明}.          ← 説明がある場合のみ
Generate accurate, concise learning content from the information supplied by the user.
Submit the result only through the "submit_card" tool and follow each field description in the tool schema.
Write definitions, meanings, grammar labels, explanations, and translations in {出力言語}.

Key requirements:
- {言語固有の注意事項}
```

`{専門分野}` は、学習言語が指定されていれば言語プロファイルの `expertLabel`、指定がなければ Content Type 名を用いる。

### 6.2 ユーザーメッセージ

```
{主フィールドの表示名}: "{入力値}"
Topics: {トピック名をカンマ区切りで}        ← トピックがある場合のみ

Additional context:                          ← 他の入力欄に値がある場合のみ
- {表示名}: {値}
```

主フィールド以外で値が入力されている欄だけを追加コンテキストとして渡す。空欄は送信しない。

### 6.3 テンプレート変数

`instruction` の中では次の変数を使用できる。プロンプト構築時に置換する。

| 変数 | 置換される値 |
| --- | --- |
| `{output_language}` | 出力言語の表示名 |
| `{study_language}` | 学習言語の表示名。未指定の場合は Content Type 名 |
| `{max_items}` | 当該フィールドの `max_items` (省略時は 10) |

## 7. 言語プロファイル

スキーマの field description だけでは表現しにくい言語固有のルールを、`LANGUAGE_PROFILES` として保持する。組み込みは英語・中国語・日本語の 3 種類である。

| 言語 | `expertLabel` | 注意事項の要点 |
| --- | --- | --- |
| `en` | English language | 例文は 12 語以内。自然なコロケーションを選び、出力言語の意味を括弧で添える |
| `zh` | Chinese language | 例文は 10 語以内。名詞には量詞を添える。判定できる場合は HSK レベルを記載する |
| `ja` | Japanese language | 例文は 10 語以内。カタカナは外来語のみ。判定できる場合は JLPT レベルを記載する。仮名だけの語では漢越音を空文字列とする |

該当する言語プロファイルが存在しない場合は、汎用の注意事項を用いる。内容は、当該言語向けの自然で正確な学習コンテンツを作ること、例文を短く自然に保つこと、そして発音やレベルが不明な場合は推測せず空文字列を返すことである。

## 8. ツール契約

| 項目 | 値 |
| --- | --- |
| ツール名 | `submit_card` |
| 説明 | `Submit the enriched {学習言語} vocabulary card.` (学習言語がない場合は Content Type 名) |
| 入力スキーマ | Zod スキーマを JSON Schema へ変換したもの |

入力スキーマは、全プロパティを `required` とし、`additionalProperties: false` を指定する。定義されていないフィールドをモデルが勝手に追加することを防ぐためである。値が不明な場合は、フィールドを省略するのではなく空文字列を返させる。

## 改訂履歴

| 版数 | 日付 | 変更内容 | 変更者 |
| --- | --- | --- | --- |
| 1.0 | 2026-07-31 | 初版作成。実装 (`lib/ai-agent/`) を正として、データ駆動プロンプトエンジンの仕様を記述。旧版の言語別ハードコードプロンプト仕様 (要件定義書 v1.1 第 10 章) は本書で置き換える | hong-quyen |
