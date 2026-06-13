'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Play, Square, RefreshCw, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface AudioPlayerProps {
  audioUrl: string | null
  onRegenerate: () => void
  loading?: boolean
  label?: string
}

export function AudioPlayer({ audioUrl, onRegenerate, loading, label = 'Audio' }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (!audioUrl) return

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setIsPlaying(false)
    }

    if (isPlaying) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <div
      className="flex items-center gap-3"
      {...verifyAttrs({ unit: 'AudioPlayer', playing: isPlaying, hasAudio: !!audioUrl, loading: !!loading })}
    >
      <span className="text-sm font-medium text-on-surface flex items-center gap-1.5">
        <Volume2 className="w-4 h-4 text-on-surface-var" />
        {label}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          disabled={!audioUrl || loading}
          className={cn(isPlaying && 'text-primary')}
        >
          {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Stop' : 'Play'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={loading}
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
          {loading ? 'Generating...' : 'Regenerate'}
        </Button>
      </div>
    </div>
  )
}
