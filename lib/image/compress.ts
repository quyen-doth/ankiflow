import { dataUrlBytes } from '@/lib/cardValidation'

export interface CompressOptions {
  /** 長辺の最大ピクセル。既定 1600px。 */
  maxDimension?: number
  /** 目標バイト数 (decoded)。既定 500KB — Firestore の 1MB/doc 制限より十分小さく保つ。 */
  targetBytes?: number
  /** 圧縮品質の下限。既定 0.5。 */
  minQuality?: number
  /** 出力 MIME。既定 image/jpeg。 */
  mimeType?: string
}

/**
 * 長辺を maxDimension 以下に収める縮小後サイズを計算する (アスペクト比維持、拡大はしない)。
 * canvas を使わない純粋関数なのでユニットテスト可能。
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width, height }
  const longest = Math.max(width, height)
  if (longest <= maxDimension) return { width, height }
  const scale = maxDimension / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = src
  })
}

/**
 * クライアント側で画像を縮小・再圧縮し data-URL を返す。ユーザーは大きい画像を
 * 「使える」一方、Firestore に保存されるサイズは小さく保たれる (カード表示は ~220px)。
 * canvas が使えない / 既に十分小さい / 圧縮で逆に大きくなる場合は元の data-URL を返す。
 */
export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<string> {
  const {
    maxDimension = 1600,
    targetBytes = 500 * 1024,
    minQuality = 0.5,
    mimeType = 'image/jpeg',
  } = opts

  const original = await readAsDataUrl(file)
  if (!original.startsWith('data:image')) return original

  let img: HTMLImageElement
  try {
    img = await loadImage(original)
  } catch {
    return original
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return original

  const { width, height } = computeTargetDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    maxDimension,
  )
  canvas.width = width
  canvas.height = height
  ctx.drawImage(img, 0, 0, width, height)

  let quality = 0.9
  let best = canvas.toDataURL(mimeType, quality)
  while (dataUrlBytes(best) > targetBytes && quality > minQuality) {
    quality = Math.max(minQuality, Math.round((quality - 0.1) * 100) / 100)
    best = canvas.toDataURL(mimeType, quality)
  }

  // 元より小さくなった時だけ採用 (再エンコードで逆に大きくなる小さい画像は元を維持)。
  return dataUrlBytes(best) > 0 && dataUrlBytes(best) < dataUrlBytes(original) ? best : original
}
