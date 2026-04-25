export const getEnglishPrompt = (word: string) => `
Bạn là chuyên gia ngôn ngữ Tiếng Anh dạy cho người Việt Nam.
Với từ "${word}", hãy cung cấp thông tin theo format JSON.

YÊU CẦU QUAN TRỌNG:
- Câu ví dụ phải NGẮN GỌN (dưới 12 từ), dễ hiểu, tự nhiên.
- Collocations: 3-5 cụm từ/collocation phổ biến, kèm nghĩa TV.
  Ví dụ với "book": "book a flight (đặt vé máy bay)", "read a book (đọc sách)"

{
  "word": "${word}",
  "ipa": "",
  "meaning_vi": "",
  "word_type_vi": "",
  "example_sentence": "",
  "example_translation": "",
  "example_blank": "",
  "collocations": [],
  "unsplash_search_keyword": ""
}
`;
