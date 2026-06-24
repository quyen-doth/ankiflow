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
  title?: string
  subtitle?: string
}

export function AudioPlayer({
  audioUrl,
  onRegenerate,
  loading,
  title = 'Native pronunciation',
  subtitle = 'Google TTS',
}: AudioPlayerProps) {
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
      className="flex items-center gap-3.5"
      {...verifyAttrs({ unit: 'AudioPlayer', playing: isPlaying, hasAudio: !!audioUrl, loading: !!loading })}
    >
      <span className="w-10 h-10 rounded-[10px] bg-[#f2f2ef] text-slate-600 flex items-center justify-center flex-shrink-0">
        <Volume2 className="w-[18px] h-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold text-ink">{title}</p>
        <p className="text-[12px] text-slate-400 truncate">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={togglePlay}
          disabled={!audioUrl || loading}
          leftIcon={isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRegenerate}
          disabled={loading}
          leftIcon={<RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />}
        >
          {loading ? 'Generating...' : 'Regenerate'}
        </Button>
      </div>
    </div>
  )
}
