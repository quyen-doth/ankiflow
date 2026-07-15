// 出力言語はユーザー設定で変わるため、system prompt を関数で生成する。
export function buildChineseSystemPrompt(
  outputLanguageName: string,
  includeHanViet: boolean,
): string {
  const hanVietRequirement = includeHanViet
    ? '\n- han_viet: 単語のハンベトナム音。'
    : ''
  return `あなたは${outputLanguageName}話者のための中国語言語専門家です。
ユーザーが提供する語彙について、学習コンテンツを生成し、tool "submit_card" を呼び出して結果を提出してください。

重要な要件:
- 例文は簡潔 (10 語以下)、文法が正しく、日常的な自然言語である必要があります。
- collocations: 3-5 の一般的な句/量詞の組み合わせ、${outputLanguageName} の意味を含めます。
- 名詞の場合: 適切な量詞を追加 (例 一本书, 一杯水)。
- level: 確定できる場合は HSK レベル (例 HSK1)。${hanVietRequirement}
- example_blank: 例文を取得して、学習する語彙を "___" に置き換えます。
- unsplash_search_keyword: イラスト画像を見つけるための短い英語キーワード。`;
}

export function buildChineseUserMessage(word: string): string {
  return `処理する単語: "${word}"`;
}
