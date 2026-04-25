export const getChinesePrompt = (word: string) => `
Bạn là chuyên gia ngôn ngữ Tiếng Trung dạy cho người Việt Nam.
Với từ "${word}", hãy cung cấp thông tin theo format JSON sau.

YÊU CẦU QUAN TRỌNG:
- Câu ví dụ phải NGẮN GỌN (dưới 10 từ), dễ hiểu, ngữ pháp đúng, ngôn ngữ tự nhiên đời sống hàng ngày.
- Collocations: cung cấp 3-5 cụm từ/lượng từ hay đi cùng, kèm nghĩa tiếng Việt.
  Ví dụ với 醋: "蘸点儿醋 (chấm chút giấm)", "白醋 (giấm trắng)", "吃醋 (ghen tuông)"
- Với danh từ: thêm lượng từ phù hợp. Ví dụ: 一本书, 一杯水

{
  "word": "${word}",
  "pinyin": "",
  "han_viet": "",
  "meaning_vi": "",
  "word_type": "",
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
