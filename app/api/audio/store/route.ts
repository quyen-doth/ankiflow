import { apiSuccess, apiError, catchError } from '@/lib/api-response'
import { storeAudioInAnki } from '@/lib/audio-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { base64, filename } = body

    if (!base64 || !filename) {
      return apiError('Missing base64 or filename', 400)
    }

    const storedFilename = await storeAudioInAnki(filename, base64)
    return apiSuccess({ success: true, filename: storedFilename })
  } catch (error) {
    console.error('Audio Store Error:', error)
    // Dùng 503 cho lỗi kết nối AnkiConnect (TypeError: fetch failed)
    const status = error instanceof TypeError ? 503 : 500
    return catchError(error, status)
  }
}
