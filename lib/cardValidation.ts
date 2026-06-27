import { FormType } from '@/types'
import { resolveBuiltinFormType } from '@/lib/create/formBlueprint'
import type { Entry } from '@/types'

export interface CardValidationError {
  field: string
  label: string
}

/** Getter linh hoạt — khớp khác biệt tên field giữa các content type (English/IT/General/Dynamic). */
const get = {
  word: (e: Partial<Entry>) => (e.word || e.term || e.title || '').trim(),
  meaning: (e: Partial<Entry>) =>
    (
      e.meaning_vi ||
      e.definition ||
      (e as Record<string, string>).definition_vi ||
      e.content ||
      ''
    ).trim(),
  reading: (e: Partial<Entry>) => (e.hiragana || e.pinyin || e.ipa || '').trim(),
  word_type: (e: Partial<Entry>) => (e.word_type || '').trim(),
  example: (e: Partial<Entry>) =>
    (e.example_sentence || (e as Record<string, string>).example_usage || '').trim(),
  translation: (e: Partial<Entry>) => (e.example_translation || '').trim(),
}

type FieldKey = keyof typeof get

const FIELD_LABELS: Record<FieldKey, string> = {
  word: 'Từ / Thuật ngữ / Tiêu đề',
  meaning: 'Nghĩa',
  reading: 'Phiên âm',
  word_type: 'Loại từ',
  example: 'Câu ví dụ',
  translation: 'Bản dịch câu ví dụ',
}

/** Tập field nội dung cốt lõi bắt buộc theo loại content. */
function requiredFieldsFor(entry: Partial<Entry>): FieldKey[] {
  const ft = resolveBuiltinFormType(String(entry.form_type ?? ''))
  switch (ft) {
    case FormType.LANGUAGE:
      return ['word', 'reading', 'meaning', 'word_type', 'example', 'translation']
    case FormType.IT:
      return ['word', 'meaning', 'example']
    case FormType.GENERAL:
      return ['word', 'meaning']
    default:
      // Custom / dynamic content type
      return ['word', 'meaning', 'example']
  }
}

/**
 * Kiểm tra một thẻ trước khi tạo/lưu. Trả về danh sách field còn trống.
 * Rỗng = hợp lệ. Bao gồm cả deck đã chọn và ≥1 card type.
 */
export function validateCardEntry(
  entry: Partial<Entry>,
  selectedCardTypeIds: string[],
): CardValidationError[] {
  const errors: CardValidationError[] = []

  for (const key of requiredFieldsFor(entry)) {
    if (!get[key](entry)) errors.push({ field: key, label: FIELD_LABELS[key] })
  }

  if (!(entry.anki_deck || '').trim()) {
    errors.push({ field: 'anki_deck', label: 'Anki Deck' })
  }
  if (!selectedCardTypeIds || selectedCardTypeIds.length === 0) {
    errors.push({ field: 'card_types', label: 'Card type (chọn ít nhất 1)' })
  }

  return errors
}

/** Gộp các nhãn lỗi thành 1 dòng để hiển thị toast. */
export function formatValidationMessage(errors: CardValidationError[]): string {
  return `Thiếu: ${errors.map(e => e.label).join(', ')}. Vui lòng điền đủ trước khi tạo.`
}
