'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(24, 28, 27, 0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      {...verifyAttrs({ unit: 'Modal', open, size })}
    >
      <div className={cn('bg-white rounded-xl shadow-modal w-full flex flex-col', sizeClasses[size], className)}>
        {/* Header (tonal) */}
        {title && (
          <div className="bg-surface-container rounded-t-xl px-6 py-4 flex items-start justify-between">
            <div>
              <h2 className="font-serif text-headline-sm text-on-surface">{title}</h2>
              {description && <p className="text-body-md text-on-surface-var mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-on-surface-var hover:text-on-surface transition-colors ml-4 mt-0.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
