'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Check, Upload, Search, ImageIcon } from 'lucide-react'
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onUpload(reader.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const creditItem = images.find(img => img.url === selectedUrl)

  return (
    <div
      className="flex flex-col gap-4"
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
          No images found. Try &quot;Find more&quot; or upload your own.
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
