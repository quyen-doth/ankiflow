'use client'

import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { verifyAttrs } from '@/verify/core/contract'
import type { LanguageDetection } from '@/lib/ai-agent'

interface DetectedLanguageModalProps {
  open: boolean
  detection: LanguageDetection | null
  existingDisabled: boolean
  saving: boolean
  onConfirm: () => void
  onClose: () => void
}

export function DetectedLanguageModal({
  open,
  detection,
  existingDisabled,
  saving,
  onConfirm,
  onClose,
}: DetectedLanguageModalProps) {
  if (!detection) return null
  const action = existingDisabled ? 'Enable & use' : 'Add & use'

  return (
    <Modal
      open={open}
      onClose={onClose}
      onConfirm={saving ? undefined : onConfirm}
      title={existingDisabled ? 'Enable detected language?' : 'Add detected language?'}
      description="This language is not currently available in your Create form."
      size="sm"
    >
      <div {...verifyAttrs({ unit: 'DetectedLanguageModal', code: detection.code, existingDisabled })}>
        <div className="flex items-center gap-3 p-4 rounded-[10px] bg-primary-bg border border-primary/15">
          <span className="w-10 h-10 rounded-[9px] bg-white flex items-center justify-center text-primary">
            <Languages className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-ink">{detection.display_name}</p>
            <p className="text-[12px] text-slate-600 font-mono">
              {detection.code} · {Math.round(detection.confidence * 100)}% confidence
            </p>
          </div>
        </div>
        <p className="text-[12.5px] text-slate-600 leading-relaxed mt-4">
          {existingDisabled
            ? 'This language already exists in Settings but is disabled. Enable it and continue generating the card?'
            : 'Add this language to your personal Settings and continue generating the card?'}
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" variant="primary" onClick={onConfirm} loading={saving}>{action}</Button>
        </div>
      </div>
    </Modal>
  )
}
