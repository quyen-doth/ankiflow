'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEffectiveMediaFlags } from '@/hooks/useEffectiveMediaFlags'
import { useToast } from '@/components/ui/Toast'
import { FormType, type Entry } from '@/types'
import type { ImageItem } from '@/components/preview/ImageSelector'

/**
 * flashcard の review/編集画面用の挿絵 (Unsplash) + TTS audio 管理。
 * Preview (新規作成) と History (編集) で共用。
 * `ready` = entry の読込完了 → 候補画像の自動 fetch と audio の init/生成を行う。
 */
export function useCardMedia(
  entry: Partial<Entry>,
  setEntry: React.Dispatch<React.SetStateAction<Partial<Entry>>>,
  ready: boolean,
  usesExampleAudio = false,
) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [imageLoading, setImageLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioExampleUrl, setAudioExampleUrl] = useState<string | null>(null)
  const [audioExampleLoading, setAudioExampleLoading] = useState(false)
  const audioExampleInFlight = useRef(false)
  const toast = useToast()
  // "上限モデル" — admin の無効化 (API コスト) AND user 自身の Preferences 設定。
  const { effectiveTts, effectiveUnsplash } = useEffectiveMediaFlags()

  const keywordOf = useCallback(
    () =>
      ((entry as Record<string, unknown>).unsplash_search_keyword as string) ||
      entry.word ||
      entry.term ||
      '',
    [entry],
  )

  const fetchImages = useCallback(
    async (keyword?: string) => {
      if (!effectiveUnsplash) return
      const searchKeyword = keyword || keywordOf()
      if (!searchKeyword) return
      setImageLoading(true)
      try {
        const res = await fetch(`/api/image?keyword=${encodeURIComponent(searchKeyword)}&count=5`)
        if (res.ok) {
          const data = await res.json()
          setImages(data.images ?? [])
        }
      } catch (err) {
        console.error('Image fetch error:', err)
      } finally {
        setImageLoading(false)
      }
    },
    [keywordOf, effectiveUnsplash],
  )

  const generateAudio = useCallback(async () => {
    if (!effectiveTts) return
    const text = entry.word || entry.term || entry.title
    if (!text) return
    // Language cards need an explicit language; IT/General content falls back to English audio.
    const language = entry.language || (entry.form_type === FormType.LANGUAGE ? null : 'en')
    if (!language) return
    setAudioLoading(true)
    try {
      const res = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          filename: `ankiflow_${text.replace(/[\s/\\:*?"<>|]/g, '_')}.mp3`,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const dataUrl = `data:audio/mp3;base64,${data.base64}`
        setAudioUrl(dataUrl)
        setEntry((prev) => ({ ...prev, audio_url: dataUrl }))
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast.warning(data.error ? `Audio unavailable: ${data.error}` : 'Audio is unavailable for this language.')
      }
    } catch (err) {
      console.error('Audio generation error:', err)
      toast.warning('Audio generation failed. Please try again.')
    } finally {
      setAudioLoading(false)
    }
  }, [entry.word, entry.term, entry.title, entry.language, entry.form_type, setEntry, effectiveTts, toast])

  const generateExampleAudio = useCallback(async () => {
    if (!effectiveTts || !usesExampleAudio || audioExampleInFlight.current) return
    const text = entry.example_sentence?.trim()
    if (!text) return
    // Language cards need an explicit language; IT/General content falls back to English audio.
    const language = entry.language || (entry.form_type === FormType.LANGUAGE ? null : 'en')
    if (!language) return
    const filenameSource = entry.word || entry.term || entry.title || 'example'
    audioExampleInFlight.current = true
    setAudioExampleLoading(true)
    try {
      const res = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          filename: `ankiflow_audio_ex_${filenameSource.replace(/[\s/\\:*?"<>|]/g, '_')}.mp3`,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const dataUrl = `data:audio/mp3;base64,${data.base64}`
        setAudioExampleUrl(dataUrl)
        setEntry(prev => ({ ...prev, audio_example_url: dataUrl }))
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast.warning(data.error
          ? `Example audio unavailable: ${data.error}`
          : 'Example audio is unavailable for this language.')
      }
    } catch (err) {
      console.error('Example audio generation error:', err)
      toast.warning('Example audio generation failed. Please try again.')
    } finally {
      audioExampleInFlight.current = false
      setAudioExampleLoading(false)
    }
  }, [
    effectiveTts,
    usesExampleAudio,
    entry.example_sentence,
    entry.language,
    entry.form_type,
    entry.word,
    entry.term,
    entry.title,
    setEntry,
    toast,
  ])

  const handleImageSelect = useCallback(
    (img: ImageItem) => {
      setEntry((prev) => ({ ...prev, image_url: img.url, image_credit: `${img.credit_name} on Unsplash` }))
    },
    [setEntry],
  )

  const handleImageUpload = useCallback(
    (dataUrl: string) => {
      setEntry((prev) => ({ ...prev, image_url: dataUrl, image_credit: '' }))
    },
    [setEntry],
  )

  // entry 準備完了時: 候補画像を自動取得し、audio が無ければ生成。
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      if (keywordOf() && images.length === 0) fetchImages()
      const text = entry.word || entry.term || entry.title
      if (text && !audioUrl && !entry.audio_url) generateAudio()
    }, 0)
    return () => clearTimeout(timer)
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // 選択 template が例文 audio を使う場合だけ生成し、選択変更にも追従する。
  useEffect(() => {
    if (
      !ready
      || !usesExampleAudio
      || !effectiveTts
      || !entry.example_sentence?.trim()
      || audioExampleUrl
      || entry.audio_example_url
    ) return
    const timer = setTimeout(() => {
      void generateExampleAudio()
    }, 0)
    return () => clearTimeout(timer)
  }, [
    ready,
    usesExampleAudio,
    effectiveTts,
    entry.example_sentence,
    entry.language,
    entry.form_type,
    entry.audio_example_url,
    audioExampleUrl,
    generateExampleAudio,
  ])

  return {
    images,
    imageLoading,
    // 生成直後の audio を優先し、entry 既存の audio に fallback (History 画面)。
    audioUrl: audioUrl ?? entry.audio_url ?? null,
    audioLoading,
    audioExampleUrl: audioExampleUrl ?? entry.audio_example_url ?? null,
    audioExampleLoading,
    fetchImages,
    generateAudio,
    generateExampleAudio,
    handleImageSelect,
    handleImageUpload,
    // 現在の "上限" — ボタンの非表示/disable に使える (全 leaf component へは未伝播)。
    effectiveTts,
    effectiveUnsplash,
  }
}
