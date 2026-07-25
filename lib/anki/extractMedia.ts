import { ANKI_EXAMPLE_AUDIO_FILENAME_PREFIX } from '@/lib/anki/mediaFilenames'
import type { BuildNotesMedia } from '@/lib/buildNotes'

/**
 * 既存の Anki note の HTML からメディアファイル名 (audio + 画像) を抽出し、新しい template で
 * Front/Back を再生成する際に再利用する — audio/画像の消失を防ぐ。
 *
 * - `audioFilename`: 通常の `[sound:FILE]`。
 * - `audioExampleFilename`: `ankiflow_audio_ex_` prefix を持つ例文 audio。
 * - `imageFilename`: `<img>` の `src` だが、Anki メディアファイル名の場合のみ (http URL ではない)、
 *   http 画像は `buildNotes` が `entry.image_url` から自動的に再埋め込みするため。
 */
export function extractMedia(html: string): BuildNotesMedia {
  const result: BuildNotesMedia = {}

  const audioFilenames = Array.from(
    html.matchAll(/\[sound:(.+?)\]/g),
    match => match[1]?.trim(),
  ).filter((filename): filename is string => Boolean(filename))
  for (const filename of audioFilenames) {
    if (filename.startsWith(ANKI_EXAMPLE_AUDIO_FILENAME_PREFIX)) {
      result.audioExampleFilename ??= filename
    } else {
      result.audioFilename ??= filename
    }
  }

  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i)
  const src = imgMatch?.[1]?.trim()
  if (src && !/^https?:\/\//i.test(src) && !src.startsWith('data:')) {
    result.imageFilename = src
  }

  return result
}
