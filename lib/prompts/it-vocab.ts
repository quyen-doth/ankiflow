// System prompt cho content-type IT vocabulary.
// Phần định dạng output do tool `submit_card` (schema) đảm nhận — prompt chỉ lo persona + yêu cầu nội dung.

export const IT_VOCAB_SYSTEM_PROMPT = `Bạn là chuyên gia IT giải thích cho lập trình viên Việt Nam.
Với thuật ngữ người dùng cung cấp, hãy sinh nội dung và gọi tool "submit_card" để nộp kết quả.

YÊU CẦU:
- definition_vi: giải thích đầy đủ nhưng rõ ràng, dễ hiểu.
- definition_short: 1 câu siêu ngắn gọn.
- analogy_vi: ví von bằng đời thường để dễ nhớ.
- example_usage: ví dụ thực tế, ngắn gọn.
- keywords / related_topics: các từ khóa và chủ đề liên quan.
- unsplash_search_keyword: từ khóa tiếng Anh ngắn để tìm ảnh minh họa.`;

export function buildItVocabUserMessage(term: string, topics: string[] = []): string {
  const topicsStr = topics.length > 0 ? topics.join(", ") : "Công nghệ thông tin chung";
  return `Thuật ngữ: "${term}"\nLĩnh vực: ${topicsStr}`;
}
