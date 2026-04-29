import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AnkiFlowLogoProps {
  href?: string
  className?: string
  size?: 'sm' | 'md'
}

export function AnkiFlowLogo({ href = '/dashboard', className, size = 'md' }: AnkiFlowLogoProps) {
  const content = (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-full bg-primary text-white flex-shrink-0',
        size === 'md' ? 'w-9 h-9' : 'w-7 h-7'
      )}>
        <Sparkles className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
      </div>
      <div>
        <p className={cn('font-serif font-bold text-primary leading-none', size === 'md' ? 'text-lg' : 'text-base')}>
          AnkiFlow
        </p>
        <p className="text-[9px] font-semibold tracking-[0.12em] text-on-surface-var uppercase leading-none mt-0.5">
          Cognitive Sanctuary
        </p>
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
