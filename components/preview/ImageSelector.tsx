'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Check, RefreshCw, Upload } from 'lucide-react'
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

  return (
    <div
      className="flex flex-col gap-3"
      {...verifyAttrs({ unit: 'ImageSelector', count: images.length, loading: !!loading, selected: selectedUrl })}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">Illustration</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRefetch} disabled={loading}>
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
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
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-video bg-surface-low rounded-lg animate-pulse" />
          ))}
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {images.slice(0, 4).map(img => (
            <button
              key={img.id}
              type="button"
              aria-label={`Select image: ${img.credit_name}`}
              onClick={() => onSelect(img)}
              className={cn(
                'relative aspect-video rounded-lg overflow-hidden border-2 transition-all',
                selectedUrl === img.url
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-transparent hover:border-outline-var'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumb}
                alt={`Photo by ${img.credit_name}`}
                className="w-full h-full object-cover"
              />
              {selectedUrl === img.url && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-var py-4 text-center">
          No images found. Try &quot;Find more&quot; or upload your own.
        </p>
      )}

      {selectedUrl && (
        <div className="aspect-video rounded-lg overflow-hidden border border-outline-var/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedUrl}
            alt="Selected illustration"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {selectedUrl && images.some(img => img.url === selectedUrl) && (
        <p className="text-label-sm text-on-surface-var">
          Photo by{' '}
          <a
            href={images.find(img => img.url === selectedUrl)?.credit_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {images.find(img => img.url === selectedUrl)?.credit_name}
          </a>
          {' '}on{' '}
          <a
            href="https://unsplash.com/?utm_source=ankiflow&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Unsplash
          </a>
        </p>
      )}
    </div>
  )
}
