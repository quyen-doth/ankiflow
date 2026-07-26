import { describe, expect, it } from 'vitest'
import { detectByScript, isScriptCompatibleWithTarget } from '@/lib/create/scriptDetection'

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

describe('isScriptCompatibleWithTarget', () => {
  it('漢字だけの語は日本語・中国語のどちらでも互換 (学習言語が決める)', () => {
    // 冪等性 は日本語だが漢字のみ — 学習言語が ja なら AI へ問い合わせずそのまま使う。
    expect(isScriptCompatibleWithTarget('冪等性', 'ja')).toBe(true)
    expect(isScriptCompatibleWithTarget('冪等性', 'zh')).toBe(true)
    expect(isScriptCompatibleWithTarget('冪等性', 'en')).toBe(false)
  })

  it('かなは日本語のみ互換', () => {
    expect(isScriptCompatibleWithTarget('たべる', 'ja')).toBe(true)
    expect(isScriptCompatibleWithTarget('たべる', 'zh')).toBe(false)
  })

  it('ハングルとタイ文字をそれぞれの言語に対応させる', () => {
    expect(isScriptCompatibleWithTarget('안녕하세요', 'ko')).toBe(true)
    expect(isScriptCompatibleWithTarget('안녕하세요', 'ja')).toBe(false)
    expect(isScriptCompatibleWithTarget('สวัสดี', 'th')).toBe(true)
  })

  it('Latin 文字の学習言語は常に false — 文字体系では判別できない', () => {
    // "chó" も "dog" も Latin だが、学習言語が英語なら前者は翻訳が必要。
    expect(isScriptCompatibleWithTarget('chó', 'en')).toBe(false)
    expect(isScriptCompatibleWithTarget('dog', 'en')).toBe(false)
    expect(isScriptCompatibleWithTarget('water', 'ja')).toBe(false)
  })

  it('region 付きの学習言語も primary subtag で照合', () => {
    expect(isScriptCompatibleWithTarget('たべる', 'ja-JP')).toBe(true)
    expect(isScriptCompatibleWithTarget('你好', 'zh-TW')).toBe(true)
  })

  it('空文字や不正な言語コードは false', () => {
    expect(isScriptCompatibleWithTarget('   ', 'ja')).toBe(false)
    expect(isScriptCompatibleWithTarget('冪等性', 'not a language')).toBe(false)
  })
})
