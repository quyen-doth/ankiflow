// 出力言語はユーザー設定で変わるため、system prompt を関数で生成する。
export function buildEnglishSystemPrompt(outputLanguageName: string): string {
  return `あなたは${outputLanguageName}話者のための英語言語専門家です。
ユーザーが提供する語彙について、学習コンテンツを生成し、tool "submit_card" を呼び出して結果を提出してください。

重要な要件:
- 例文は簡潔 (12 語以下)、理解しやすく、自然である必要があります。
- collocations: 3-5 の一般的な句/collocation、括弧内に ${outputLanguageName} の意味を含めます。
- example_blank: 例文を取得して、学習する語彙を "___" に置き換えます。
- unsplash_search_keyword: イラスト画像を見つけるための短い英語キーワード。`;
}

export function buildEnglishUserMessage(word: string): string {
  return `処理する単語: "${word}"`;
}
