'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Brain, X } from 'lucide-react'
import { StepIndicator } from './StepIndicator'
import { ProgressBar } from './ProgressBar'
import { FlowTip } from './FlowTip'
import { overlayFade, scaleModal } from '@/lib/motion'
import { verifyAttrs } from '@/verify/core/contract'

interface LoadingStep {
  label: string
  description?: string
  status: 'completed' | 'active' | 'pending'
}

interface LoadingOverlayProps {
  open: boolean
  title?: string
  subtitle?: string
  steps: LoadingStep[]
  progress: number
  flowTip?: string
  statusText?: string
  onCancel?: () => void
  cancelLabel?: string
}

export function LoadingOverlay({
  open,
  title = 'Generating Cognitive Asset',
  subtitle = 'Refining semantic associations for long-term retention',
  steps,
  progress,
  flowTip,
  statusText,
  onCancel,
  cancelLabel = 'Cancel',
}: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(21,23,28,0.3)', backdropFilter: 'blur(4px)' }}
          variants={overlayFade}
          initial="hidden"
          animate="show"
          exit="exit"
          {...verifyAttrs({ unit: 'LoadingOverlay', open, progress })}
        >
          <motion.div className="bg-white rounded-card shadow-modal w-full max-w-md p-8 flex flex-col gap-6" variants={scaleModal}>
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary/60" />
          </div>
          <div>
            <h2 className="text-section-heading font-extrabold text-primary">{title}</h2>
            <p className="text-body text-slate-600 mt-1">{subtitle}</p>
          </div>
        </div>

        {/* Steps */}
        <StepIndicator steps={steps} />

        {/* Progress */}
        <ProgressBar value={progress} label="Global Progress" showPercent />

        {/* Flow tip */}
        {flowTip && <FlowTip>{flowTip}</FlowTip>}

        {/* Status text */}
        {statusText && (
          <p className="text-center text-secondary text-slate-400 italic">{statusText}</p>
        )}

        {/* Cancel */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mx-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-600 hover:text-danger transition-colors"
          >
            <X className="w-4 h-4" />
            {cancelLabel}
          </button>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
