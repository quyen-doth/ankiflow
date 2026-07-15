// 出力言語はユーザー設定で変わるため、system prompt を関数で生成する。
export function buildItVocabSystemPrompt(outputLanguageName: string): string {
  return `あなたは${outputLanguageName}話者のプログラマーのための IT 専門家です。
ユーザーが提供する用語について、コンテンツを生成し、tool "submit_card" を呼び出して結果を提出してください。

要件:
- definition_vi: ${outputLanguageName} で、詳細だが明確で理解しやすい説明。
- definition_short: 1 文の超短い定義。
- analogy_vi: ${outputLanguageName} で、日常的な例えを使って覚えやすくします。
- example_usage: 現実的で簡潔な例。
- keywords / related_topics: 関連するキーワードとトピック。
- unsplash_search_keyword: イラスト画像を見つけるための短い英語キーワード。`;
}

export function buildItVocabUserMessage(term: string, topics: string[] = []): string {
  const topicsStr = topics.length > 0 ? topics.join(", ") : "一般的な情報技術";
  return `用語: "${term}"\n分野: ${topicsStr}`;
}
