export const getItVocabPrompt = (term: string, topics: string[] = []) => {
  const topicsStr = topics.length > 0 ? topics.join(", ") : "Công nghệ thông tin chung";
  return `
Bạn là chuyên gia IT giải thích cho lập trình viên Việt Nam.
Với thuật ngữ "${term}" trong lĩnh vực "${topicsStr}", hãy cung cấp thông tin theo format JSON.

YÊU CẦU:
- definition_vi: giải thích đầy đủ nhưng rõ ràng, dễ hiểu
- definition_short: 1 câu siêu ngắn gọn
- analogy_vi: ví von bằng đời thường để dễ nhớ
- example_usage: ví dụ thực tế, ngắn gọn

{
  "term": "${term}",
  "definition_vi": "",
  "definition_short": "",
  "example_usage": "",
  "keywords": [],
  "related_topics": [],
  "analogy_vi": "",
  "unsplash_search_keyword": ""
}
`;
};
