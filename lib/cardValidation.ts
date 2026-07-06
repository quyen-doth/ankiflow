import { FormType } from '@/types'
import { resolveBuiltinFormType } from '@/lib/create/formBlueprint'
import type { Entry } from '@/types'

export interface CardValidationError {
  field: string
  label: string
}

/** Ngưỡng dung lượng ảnh nhúng vào thẻ. Card hiển thị ảnh nhỏ (max-height 220px) nên 800KB là dư. */
export const MAX_IMAGE_BYTES = 800 * 1024

/** Ước lượng số byte của một data URL từ độ dài phần base64. Trả 0 nếu không phải data URL. */
export function dataUrlBytes(dataUrl: string | undefined | null): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
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

  // Ảnh cục bộ (data URL) quá lớn → chặn export. Ảnh URL http không lưu media nên bỏ qua.
  const imgBytes = dataUrlBytes(entry.image_url)
  if (imgBytes > MAX_IMAGE_BYTES) {
    const mb = (imgBytes / (1024 * 1024)).toFixed(1)
    errors.push({ field: 'image', label: `Ảnh minh hoạ quá lớn (${mb}MB, tối đa 0.8MB)` })
  }

  return errors
}

/** Gộp các nhãn lỗi thành 1 dòng để hiển thị toast. */
export function formatValidationMessage(errors: CardValidationError[]): string {
  return `Thiếu: ${errors.map(e => e.label).join(', ')}. Vui lòng điền đủ trước khi tạo.`
}

export interface InvalidCard {
  index: number
  errors: CardValidationError[]
}

/** Quét toàn bộ thẻ, trả về danh sách thẻ lỗi (kèm index) để hiện banner + đánh dấu nav strip. */
export function collectInvalidCards(
  entries: Partial<Entry>[],
  selectedCardTypeIds: string[],
): InvalidCard[] {
  const result: InvalidCard[] = []
  for (let i = 0; i < entries.length; i++) {
    const errors = validateCardEntry(entries[i], selectedCardTypeIds)
    if (errors.length > 0) result.push({ index: i, errors })
  }
  return result
}
