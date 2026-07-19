'use client'

import { useRef, useState } from 'react'
import { ANKI_CARD_CSS } from '@/lib/anki/model'

// renderSide の内容を包む CSS — iframe を実際の Anki カード面と同じ見た目にする。
const PREVIEW_STYLE = `
body { margin: 0; padding: 16px; background: #f0f0ec; }
${ANKI_CARD_CSS}
.card { border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.audio-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 600; color: #316342;
  background: #E6F0EA; padding: 4px 12px; border-radius: 20px;
}
`

const EMPTY = '<div style="color:#aaa;text-align:center;padding:12px;font-size:13px">No fields</div>'

/**
 * 1 カード分の preview HTML ドキュメントを構築する。
 * - `back` = undefined → 表面のみ表示 (未反転状態用)。
 * - `back` が文字列 → front + `<hr id="answer">` + back を表示 (Anki の反転後と同じ)。
 */
export function buildCardHtml(front: string, back?: string): string {
  const body =
    back === undefined
      ? front || EMPTY
      : `${front || EMPTY}\n<hr id="answer">\n${back || EMPTY}`
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${PREVIEW_STYLE}</style>
</head>
<body>
<div class="card">${body}</div>
</body>
</html>`
}

interface CardIframeProps {
  html: string
  title?: string
}

/**
 * iframe sandbox がカード HTML ドキュメントを render し、内容全体が収まるよう高さを自動計測する
 * (Unsplash 画像の load 完了時に再計測)。Review ページと Admin card editor の preview で共用。
 */
export function CardIframe({ html, title = 'Card preview' }: CardIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  const handleLoad = () => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc) return
    const measure = () => {
      const h = doc.documentElement.scrollHeight || doc.body.scrollHeight
      if (h) setHeight(h)
    }
    measure()
    doc.querySelectorAll('img').forEach(img => {
      if (!img.complete) img.addEventListener('load', measure, { once: true })
    })
  }

  return (
    <iframe
      ref={iframeRef}
      onLoad={handleLoad}
      srcDoc={html}
      style={{ width: '100%', height: `${height}px`, minHeight: '160px', border: 'none', display: 'block' }}
      title={title}
      sandbox="allow-same-origin"
    />
  )
}
