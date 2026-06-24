'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Entry } from '@/types'
import type { ImageItem } from '@/components/preview/ImageSelector'

/**
 * Quản lý ảnh minh họa (Unsplash) + audio TTS cho trang review/sửa flashcard.
 * Dùng chung cho Preview (tạo mới) và History (sửa).
 * `ready` = true khi entry đã load xong → tự fetch ảnh gợi ý & init/gen audio.
 */
export function useCardMedia(
  entry: Partial<Entry>,
  setEntry: React.Dispatch<React.SetStateAction<Partial<Entry>>>,
  ready: boolean,
) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [imageLoading, setImageLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)

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
    [keywordOf],
  )

  const generateAudio = useCallback(async () => {
    const text = entry.word || entry.term || entry.title
    if (!text) return
    setAudioLoading(true)
    try {
      const res = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: entry.language || 'en',
          filename: `ankiflow_${text.replace(/[\s/\\:*?"<>|]/g, '_')}.mp3`,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const dataUrl = `data:audio/mp3;base64,${data.base64}`
        setAudioUrl(dataUrl)
        setEntry((prev) => ({ ...prev, audio_url: dataUrl }))
      }
    } catch (err) {
      console.error('Audio generation error:', err)
    } finally {
      setAudioLoading(false)
    }
  }, [entry.word, entry.term, entry.title, entry.language, setEntry])

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

  // Khi entry sẵn sàng: tự lấy ảnh gợi ý & sinh audio nếu chưa có sẵn.
  useEffect(() => {
    if (!ready) return
    if (keywordOf() && images.length === 0) fetchImages()
    const text = entry.word || entry.term || entry.title
    if (text && !audioUrl && !entry.audio_url) generateAudio()
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    images,
    imageLoading,
    // Ưu tiên audio vừa sinh, fallback về audio có sẵn của entry (trang History).
    audioUrl: audioUrl ?? entry.audio_url ?? null,
    audioLoading,
    fetchImages,
    generateAudio,
    handleImageSelect,
    handleImageUpload,
  }
}
