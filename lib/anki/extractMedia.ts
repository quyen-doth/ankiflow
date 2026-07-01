/**
 * Trích tên file media (audio + ảnh) từ HTML của một note Anki cũ, để tái sử dụng khi sinh lại
 * Front/Back theo template mới — tránh mất audio/ảnh.
 *
 * - `audioFilename`: nội dung trong `[sound:FILE]`.
 * - `imageFilename`: `src` của `<img>` NHƯNG chỉ khi là tên file media Anki (không phải URL http),
 *   vì ảnh http để `buildNotes` tự nhúng lại từ `entry.image_url`.
 */
export function extractMedia(html: string): { audioFilename?: string; imageFilename?: string } {
  const result: { audioFilename?: string; imageFilename?: string } = {}

  const audioMatch = html.match(/\[sound:(.+?)\]/)
  if (audioMatch?.[1]) result.audioFilename = audioMatch[1].trim()

  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i)
  const src = imgMatch?.[1]?.trim()
  if (src && !/^https?:\/\//i.test(src) && !src.startsWith('data:')) {
    result.imageFilename = src
  }

  return result
}
