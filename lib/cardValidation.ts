import { FormType } from '@/types'
import { resolveBuiltinFormType } from '@/lib/create/formBlueprint'
import type { Entry } from '@/types'

export interface CardValidationError {
  field: string
  label: string
}

/** カードに埋め込む画像の容量しきい値。カードは小さい画像を表示 (max-height 220px) するので 800KB で十分。 */
export const MAX_IMAGE_BYTES = 800 * 1024

/** data URL の base64 部分の長さからバイト数を概算する。data URL でなければ 0 を返す。 */
export function dataUrlBytes(dataUrl: string | undefined | null): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

/** 柔軟な Getter — content type ごとのフィールド名の違い (English/IT/General/Dynamic) を吸収する。 */
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
  word: 'Word / Term / Title',
  meaning: 'Meaning',
  reading: 'Reading',
  word_type: 'Word type',
  example: 'Example sentence',
  translation: 'Example translation',
}

/** content の種類ごとの必須コアコンテンツフィールドの集合。 */
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
 * 作成/保存前のカードをチェック。空のフィールドのリストを返す。
 * 空配列 = 有効。選択された deck と ≥1 個の card type も含む。
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
    errors.push({ field: 'card_types', label: 'Card type (select at least one)' })
  }

  // ローカル画像 (data URL) が大きすぎる → export をブロック。http URL の画像はメディア保存しないのでスキップ。
  const imgBytes = dataUrlBytes(entry.image_url)
  if (imgBytes > MAX_IMAGE_BYTES) {
    const mb = (imgBytes / (1024 * 1024)).toFixed(1)
    errors.push({ field: 'image', label: `Illustration is too large (${mb}MB; maximum 0.8MB)` })
  }

  return errors
}

/** エラーラベルを 1 行にまとめて toast に表示する。 */
export function formatValidationMessage(errors: CardValidationError[]): string {
  return `Missing: ${errors.map(e => e.label).join(', ')}. Complete all required fields before creating.`
}

export interface InvalidCard {
  index: number
  errors: CardValidationError[]
}

/** すべてのカードをスキャンし、エラーのあるカードのリスト (index 付き) を返す — banner 表示 + nav strip のマーク用。 */
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
