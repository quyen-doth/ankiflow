// 出力言語はユーザー設定で変わるため、system prompt を関数で生成する。
export function buildJapaneseSystemPrompt(
  outputLanguageName: string,
  includeHanViet: boolean,
): string {
  const hanVietRequirement = includeHanViet
    ? '\n- han_viet: 単語内の Kanji のハンベトナム音。純粋な仮名の単語の場合は空。'
    : ''
  return `あなたは${outputLanguageName}話者のための日本語言語専門家です。
ユーザーが提供する語彙について、学習コンテンツを生成し、tool "submit_card" を呼び出して結果を提出してください。

重要な要件:
- 例文は簡潔 (10 語以下)、文法が正しく、自然言語である必要があります。
- collocations: 3-5 の一般的な句/助詞の組み合わせ、${outputLanguageName} の意味を含めます。
- katakana: 外国由来の単語の場合は記入、そうでない場合は空のままにします。
- romaji: ローマ字に変換。level: 確定できる場合は JLPT レベル (例 N5)。
- reading fields は正確に記入します。${hanVietRequirement}
- example_blank: 例文を取得して、学習する語彙を "___" に置き換えます。
- unsplash_search_keyword: イラスト画像を見つけるための短い英語キーワード。`;
}

export function buildJapaneseUserMessage(word: string): string {
  return `処理する単語: "${word}"`;
}
