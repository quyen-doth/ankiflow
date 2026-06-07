'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

interface UnsplashImage {
  id: string
  urls: { small: string; regular: string }
  alt_description: string
  user: { name: string; links: { html: string } }
}

interface ImageSelectorProps {
  images: UnsplashImage[]
  selectedId: string | null
  onSelect: (image: UnsplashImage) => void
  onRefetch: () => void
  loading?: boolean
}

export function ImageSelector({ images, selectedId, onSelect, onRefetch, loading }: ImageSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">Illustration</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRefetch} disabled={loading}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {loading ? 'Searching...' : 'Find more'}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-video bg-surface-low rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {images.slice(0, 4).map(img => (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(img)}
              className={cn(
                'relative aspect-video rounded-lg overflow-hidden border-2 transition-all',
                selectedId === img.id
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-transparent hover:border-outline-var'
              )}
            >
              <Image
                src={img.urls.small}
                alt={img.alt_description || 'Unsplash image'}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 200px"
              />
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <p className="text-label-sm text-on-surface-var">
          Photo from{' '}
          <a
            href={`https://unsplash.com/?utm_source=ankiflow&utm_medium=referral`}
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
