import { describe, expect, it } from 'vitest'
import { resolveTtsClientOptions } from '@/lib/tts'

// Prod (Vercel) では key file が存在しない → JSON の中身を env で渡す。
// ローカルは従来通り GOOGLE_APPLICATION_CREDENTIALS (ファイルパス) が使える。
const FAKE_SA = {
  type: 'service_account',
  project_id: 'ankiflow',
  client_email: 'tts@ankiflow.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
}

describe('lib/tts — resolveTtsClientOptions', () => {
  it('有効な GOOGLE_TTS_CREDENTIALS_JSON を credentials object に変換する', () => {
    const options = resolveTtsClientOptions({ GOOGLE_TTS_CREDENTIALS_JSON: JSON.stringify(FAKE_SA) })
    expect(options).toEqual({ credentials: FAKE_SA })
  })

  it('不正な JSON は環境変数名を含むエラーを返す', () => {
    expect(() => resolveTtsClientOptions({ GOOGLE_TTS_CREDENTIALS_JSON: '{not json' }))
      .toThrow(/GOOGLE_TTS_CREDENTIALS_JSON is not valid JSON/)
  })

  it('GOOGLE_APPLICATION_CREDENTIALS のみの場合はライブラリの自動読込を使用する', () => {
    const options = resolveTtsClientOptions({ GOOGLE_APPLICATION_CREDENTIALS: '../credentials/key.json' })
    expect(options).toEqual({})
  })

  it('認証用の環境変数がない場合は null を返す', () => {
    expect(resolveTtsClientOptions({})).toBeNull()
  })

  it('空白の JSON は未設定として key file path にフォールバックする', () => {
    const options = resolveTtsClientOptions({
      GOOGLE_TTS_CREDENTIALS_JSON: '   ',
      GOOGLE_APPLICATION_CREDENTIALS: '/path/key.json',
    })
    expect(options).toEqual({})
  })

  it('両方ある場合は JSON を優先する', () => {
    const options = resolveTtsClientOptions({
      GOOGLE_TTS_CREDENTIALS_JSON: JSON.stringify(FAKE_SA),
      GOOGLE_APPLICATION_CREDENTIALS: '/path/key.json',
    })
    expect(options).toEqual({ credentials: FAKE_SA })
  })
})
