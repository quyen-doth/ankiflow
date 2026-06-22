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
      style={{ background: 'rgba(21, 23, 28, 0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      {...verifyAttrs({ unit: 'Modal', open, size })}
    >
      <div className={cn('bg-white rounded-card shadow-modal border border-border w-full flex flex-col', sizeClasses[size], className)}>
        {/* Header */}
        {title && (
          <div className="bg-surface rounded-t-card px-6 py-4 flex items-start justify-between">
            <div>
              <h2 className="text-section-heading font-extrabold text-ink">{title}</h2>
              {description && <p className="text-body text-slate-600 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-slate-400 hover:text-ink transition-colors ml-4 mt-0.5"
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
