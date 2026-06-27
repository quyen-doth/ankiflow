import { apiSuccess, apiError, catchError } from '@/lib/api-response'
import { flashcardService } from '@/lib/flashcard-service'

/**
 * Lưu ảnh (base64) vào Anki media để nhúng vào thẻ — dùng cho ảnh cục bộ (upload/dán/kéo-thả)
 * vốn ở dạng data URL không thể tham chiếu trực tiếp trong Anki. Soi app/api/audio/store.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { base64, filename } = body

    if (!base64 || !filename) {
      return apiError('Missing base64 or filename', 400)
    }

    const storedFilename = await flashcardService.storeMediaFile(filename, base64)
    return apiSuccess({ success: true, filename: storedFilename })
  } catch (error) {
    console.error('Image Store Error:', error)
    const status = error instanceof TypeError ? 503 : 500
    return catchError(error, status)
  }
}
