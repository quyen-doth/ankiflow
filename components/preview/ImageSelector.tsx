'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Check, Upload, Search, ImageIcon, X } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'

export interface ImageItem {
  id: string
  url: string
  thumb: string
  credit_name: string
  credit_url: string
}

interface ImageSelectorProps {
  images: ImageItem[]
  selectedUrl: string | null
  onSelect: (image: ImageItem) => void
  onRefetch: () => void
  onUpload: (dataUrl: string) => void
  loading?: boolean
}

export function ImageSelector({ images, selectedUrl, onSelect, onRefetch, onUpload, loading }: ImageSelectorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onUpload(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  // Dán ảnh (file trong clipboard) hoặc URL ảnh.
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (items) {
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            processFile(file)
            return
          }
        }
      }
    }
    const text = e.clipboardData?.getData('text')?.trim()
    if (text && /^https?:\/\//i.test(text)) {
      e.preventDefault()
      onUpload(text)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) {
      processFile(file)
      return
    }
    const url = (e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '').trim()
    if (url && /^https?:\/\//i.test(url)) onUpload(url)
  }

  const creditItem = images.find(img => img.url === selectedUrl)
  // Ảnh đang chọn không thuộc gợi ý Unsplash (upload/dán/kéo-thả/URL ngoài) → hiển thị preview riêng.
  const isCustom = !!selectedUrl && !images.some(img => img.url === selectedUrl)

  return (
    <div
      className={cn('flex flex-col gap-4 rounded-[10px] transition-shadow', isDragging && 'ring-2 ring-primary ring-offset-2')}
      tabIndex={0}
      onPaste={handlePaste}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
      onDrop={handleDrop}
      {...verifyAttrs({ unit: 'ImageSelector', count: images.length, loading: !!loading, selected: selectedUrl })}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-[26px] h-[26px] rounded-[7px] bg-[rgba(49,99,66,0.1)] text-primary flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-[15px] h-[15px]" />
          </span>
          <span className="text-[12px] font-bold tracking-[0.05em] uppercase font-mono text-slate-600">
            Illustration
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} leftIcon={<Upload className="w-3.5 h-3.5" />}>
            Upload
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onRefetch} disabled={loading} leftIcon={<Search className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />}>
            {loading ? 'Searching...' : 'Find more'}
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Upload image"
        onChange={handleFileChange}
      />

      {/* Ảnh cục bộ đang chọn (upload/dán/kéo-thả/URL ngoài) — hiển thị preview riêng. */}
      {isCustom && selectedUrl && (
        <div className="relative rounded-[10px] overflow-hidden border-2 border-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedUrl} alt="Selected illustration" className="w-full max-h-[220px] object-contain bg-surface" />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => onUpload('')}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-2.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square bg-surface rounded-[10px] animate-pulse" />
          ))}
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-4 gap-2.5">
          {images.slice(0, 4).map(img => {
            const isSelected = selectedUrl === img.url
            return (
              <button
                key={img.id}
                type="button"
                aria-label={`Select image: ${img.credit_name}`}
                onClick={() => onSelect(img)}
                className={cn(
                  'relative aspect-square rounded-[10px] overflow-hidden border-2 transition-all',
                  isSelected ? 'border-primary' : 'border-[#e3e3de] hover:border-slate-400'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumb} alt={`Photo by ${img.credit_name}`} className="w-full h-full object-cover" />
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-600 py-4 text-center">
          No images found. Drag-drop, paste, or use &quot;Upload&quot; — or try &quot;Find more&quot;.
        </p>
      )}

      {creditItem && (
        <p className="text-[11px] text-slate-400">
          Photo by{' '}
          <a href={creditItem.credit_url} target="_blank" rel="noopener noreferrer" className="underline">
            {creditItem.credit_name}
          </a>{' '}on{' '}
          <a href="https://unsplash.com/?utm_source=ankiflow&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline">
            Unsplash
          </a>
        </p>
      )}
    </div>
  )
}
