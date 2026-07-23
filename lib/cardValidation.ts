import { renderSide, resolveCardTemplate } from '@/lib/anki/renderCard'
import { parseAudioDataUrl, parseImageDataUrl } from '@/lib/anki/mediaDataUrl'
import type { CardTemplate, Entry } from '@/types'

export interface CardValidationError {
  field: string
  label: string
}

export interface CardValidationCardType {
  id: string
  name: string
  code?: string
  template?: CardTemplate
}

export interface CardValidationOptions {
  /** Media filename を明示した場合、entry の data URL へ fallback しない。 */
  media?: {
    audioFilename?: string
    imageFilename?: string
  }
  /** History の既存 note 内 media は保存前に取得できないため placeholder として扱う。 */
  assumeExistingMedia?: boolean
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

/**
 * Export と同じ renderer で、選択 Card Type の Front/Back に実データがあるか確認する。
 * data URL media は export 時に filename へ変換されるため、placeholder filename を渡す。
 */
function hasRenderedSideContent(
  blocks: CardTemplate['front'],
  entry: Partial<Entry>,
  side: 'front' | 'back',
  options: CardValidationOptions,
): boolean {
  const audioFilename = options.media?.audioFilename
    ?? (!options.media && (options.assumeExistingMedia || parseAudioDataUrl(entry.audio_url))
      ? 'audio'
      : undefined)
  const imageFilename = options.media?.imageFilename
    ?? (!options.media && (options.assumeExistingMedia || parseImageDataUrl(entry.image_url))
      ? 'image'
      : undefined)
  return renderSide(blocks, entry, { side, audioFilename, imageFilename }).length > 0
}

/** 選択済み Card Type が現在利用可能で、各 Front/Back が空でないことを確認する。 */
export function validateSelectedCardTypes(
  entry: Partial<Entry>,
  selectedCardTypeIds: readonly string[],
  cardTypes: readonly CardValidationCardType[],
  options: CardValidationOptions = {},
): CardValidationError[] {
  if (selectedCardTypeIds.length === 0) {
    return [{ field: 'card_types', label: 'Card type (select at least one)' }]
  }

  const byId = new Map(cardTypes.map(cardType => [cardType.id, cardType]))
  const errors: CardValidationError[] = []

  for (const id of new Set(selectedCardTypeIds)) {
    const cardType = byId.get(id)
    if (!cardType) {
      errors.push({
        field: `card_type:${id}`,
        label: 'Selected card type is unavailable',
      })
      continue
    }

    const template = resolveCardTemplate(cardType)
    if (!hasRenderedSideContent(template.front, entry, 'front', options)) {
      errors.push({
        field: `card_type:${id}:front`,
        label: `${cardType.name}: Front has no content`,
      })
    }
    if (!hasRenderedSideContent(template.back, entry, 'back', options)) {
      errors.push({
        field: `card_type:${id}:back`,
        label: `${cardType.name}: Back has no content`,
      })
    }
  }

  return errors
}

/**
 * 作成/保存前のカードをチェック。空配列 = 有効。
 * Content Type 固有の固定 field ではなく、選択 Card Type の実際の Front/Back を検証する。
 */
export function validateCardEntry(
  entry: Partial<Entry>,
  selectedCardTypeIds: readonly string[],
  cardTypes: readonly CardValidationCardType[],
  options: CardValidationOptions = {},
): CardValidationError[] {
  const errors = validateSelectedCardTypes(entry, selectedCardTypeIds, cardTypes, options)

  if (!(entry.anki_deck || '').trim()) {
    errors.push({ field: 'anki_deck', label: 'Anki Deck' })
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
  return `Card cannot be saved: ${errors.map(e => e.label).join(', ')}.`
}

export interface InvalidCard {
  index: number
  errors: CardValidationError[]
}

/** すべてのカードをスキャンし、エラーのあるカードのリスト (index 付き) を返す — banner 表示 + nav strip のマーク用。 */
export function collectInvalidCards(
  entries: Partial<Entry>[],
  selectedCardTypeIds: readonly string[],
  cardTypes: readonly CardValidationCardType[],
): InvalidCard[] {
  const result: InvalidCard[] = []
  for (let i = 0; i < entries.length; i++) {
    const errors = validateCardEntry(entries[i], selectedCardTypeIds, cardTypes)
    if (errors.length > 0) result.push({ index: i, errors })
  }
  return result
}
