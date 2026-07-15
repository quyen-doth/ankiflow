import { describe, expect, it } from 'vitest'
import { detectByScript } from '@/lib/create/scriptDetection'

const EN = { code: 'en', display_name: 'English' }
const JA = { code: 'ja', display_name: 'Japanese' }
const ZH = { code: 'zh', display_name: 'Chinese' }

describe('detectByScript', () => {
  it('かなを日本語として判定', () => {
    expect(detectByScript(['食べる'], [JA, EN])).toEqual([
      { index: 0, code: 'ja', display_name: 'Japanese', confidence: 1 },
    ])
  })

  it('ハングルとタイ文字を判定', () => {
    expect(detectByScript(['안녕하세요'], [{ code: 'ko', display_name: 'Korean' }, EN])?.[0].code).toBe('ko')
    expect(detectByScript(['สวัสดี'], [{ code: 'th', display_name: 'Thai' }, EN])?.[0].code).toBe('th')
  })

  it('日本語候補がない場合のみ漢字だけの語を中国語として判定', () => {
    expect(detectByScript(['你好'], [ZH, EN])?.[0].code).toBe('zh')
    expect(detectByScript(['你好'], [ZH, JA, EN])).toBeNull()
  })

  it('Latin 文字と異なる文字体系の batch は AI 判定へ委ねる', () => {
    expect(detectByScript(['hello'], [EN, JA])).toBeNull()
    expect(detectByScript(['食べる', 'hello'], [JA, EN])).toBeNull()
  })

  it('判定言語が候補にない場合は null', () => {
    expect(detectByScript(['食べる'], [EN])).toBeNull()
  })

  it('同じ言語の batch を全 item 分返す', () => {
    expect(detectByScript(['勉強', '学校'], [ZH, EN])).toEqual([
      { index: 0, code: 'zh', display_name: 'Chinese', confidence: 1 },
      { index: 1, code: 'zh', display_name: 'Chinese', confidence: 1 },
    ])
  })

  it('region 付き候補を primary subtag で照合', () => {
    expect(detectByScript(
      ['たべる'],
      [{ code: 'ja-JP', display_name: '日本語' }],
    )).toEqual([
      { index: 0, code: 'ja-JP', display_name: '日本語', confidence: 1 },
    ])
  })

  it('数字・記号だけの入力を中国語と誤判定しない', () => {
    expect(detectByScript(['123!?'], [ZH, EN])).toBeNull()
  })
})
