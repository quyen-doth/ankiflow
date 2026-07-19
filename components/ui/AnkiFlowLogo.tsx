import { GalleryVerticalEnd } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface AnkiFlowLogoProps {
  href?: string
  className?: string
  size?: 'sm' | 'md'
}

export function AnkiFlowLogo({ href = '/dashboard', className, size = 'md' }: AnkiFlowLogoProps) {
  const content = (
    <div
      className={cn('flex items-center gap-2', className)}
      {...verifyAttrs({ unit: 'AnkiFlowLogo', size, linked: !!href })}
    >
      <div className={cn(
        'flex items-center justify-center rounded-[9px] bg-primary text-white flex-shrink-0',
        size === 'md' ? 'w-8 h-8' : 'w-7 h-7'
      )}>
        <GalleryVerticalEnd className={size === 'md' ? 'w-[15px] h-[15px]' : 'w-3 h-3'} />
      </div>
      <div>
        <p className={cn('font-extrabold text-primary leading-none', size === 'md' ? 'text-[15px]' : 'text-base')}>
          AnkiFlow
        </p>
        <p className="text-[8px] font-mono font-semibold tracking-[0.12em] text-slate-400 uppercase leading-none mt-0.5">
          Knowledge in Flow
        </p>
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
