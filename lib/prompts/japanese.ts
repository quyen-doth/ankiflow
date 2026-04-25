export const getJapanesePrompt = (word: string) => `
Bạn là chuyên gia ngôn ngữ Tiếng Nhật dạy cho người Việt Nam.
Với từ "${word}", hãy cung cấp thông tin theo format JSON sau.

YÊU CẦU QUAN TRỌNG:
- Câu ví dụ phải NGẮN GỌN (dưới 10 từ), dễ hiểu, ngữ pháp đúng, ngôn ngữ tự nhiên.
- Collocations: cung cấp 3-5 cụm từ/trợ từ hay đi cùng, kèm nghĩa TV.
  Ví dụ với 本: "本を読む (đọc sách)", "一冊の本 (một quyển sách)"
- Katakana nếu từ có nguồn gốc ngoại lai.

{
  "word": "${word}",
  "hiragana": "",
  "katakana": "",
  "romaji": "",
  "meaning_vi": "",
  "word_type_vi": "",
  "level": "",
  "example_sentence": "",
  "example_translation": "",
  "example_blank": "",
  "collocations": [],
  "related_words": [],
  "unsplash_search_keyword": ""
}
`;
