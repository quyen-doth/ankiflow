'use client'

import { TriangleAlert, X } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import type { BatchDuplicateResult } from '@/hooks/useDuplicateCheck'

interface BatchDuplicateModalProps {
  open: boolean
  onClose: () => void
  /** Tạo tất cả (kể cả từ đã tồn tại). */
  onProceedAll: () => void
  /** Chỉ tạo các từ MỚI, bỏ qua từ đã tồn tại. */
  onSkipDuplicates: () => void
  /** Chỉ chứa những từ CÓ bản trùng. */
  duplicates: BatchDuplicateResult[]
  /** Tổng số từ trong batch để hiển thị "X/Y trùng". */
  totalCount: number
}

/**
 * Cảnh báo trùng cho chế độ batch: liệt kê các từ đã tồn tại, cho phép vẫn tạo tất cả
 * hoặc chỉ tạo từ mới. Quy tắc kiểm tra TOÀN CỤC (không kể deck/ngôn ngữ).
 */
export function BatchDuplicateModal({
  open,
  onClose,
  onProceedAll,
  onSkipDuplicates,
  duplicates,
  totalCount,
}: BatchDuplicateModalProps) {
  if (!open) return null

  const dupCount = duplicates.length
  const newCount = totalCount - dupCount

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(20, 22, 24, 0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      {...verifyAttrs({ unit: 'BatchDuplicateModal', open, count: dupCount })}
    >
      <div className="w-[480px] max-w-full bg-white rounded-[16px] shadow-modal overflow-hidden">
        <div className="px-6 pt-[22px] pb-[18px]">
          <div className="flex items-start gap-[14px]">
            <span className="w-[42px] h-[42px] rounded-[11px] bg-[rgba(184,117,20,0.1)] flex items-center justify-center flex-shrink-0">
              <TriangleAlert className="w-5 h-5 text-[#b87514]" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-extrabold text-ink">
                {dupCount} of {totalCount} already exist
              </h2>
              <p className="text-[13.5px] text-[#7c7f87] mt-1 leading-[1.5]">
                These words already exist in your collection. Create all anyway, or only the{' '}
                {newCount} new word{newCount !== 1 ? 's' : ''}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-[30px] h-[30px] rounded-[8px] bg-canvas text-slate-400 hover:text-ink flex items-center justify-center flex-shrink-0"
            >
              <X className="w-[17px] h-[17px]" />
            </button>
          </div>

          <div className="mt-[18px] flex flex-col gap-2 max-h-[260px] overflow-y-auto">
            {duplicates.map((d) => (
              <div
                key={d.word}
                className="flex items-center gap-3 px-[14px] py-[13px] border border-[#eceae4] rounded-[11px] bg-[#fcfcfb]"
              >
                <span className="text-[14px] font-bold text-ink truncate">{d.word}</span>
                <span className="ml-auto text-[12px] text-slate-400 font-mono truncate">
                  {d.duplicates[0]?.anki_deck || 'existing'}
                  {d.duplicates.length > 1 ? ` +${d.duplicates.length - 1}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-[10px] px-6 py-4 bg-[#fbfbfa] border-t border-[#f0f0ec]">
          <button
            type="button"
            onClick={onClose}
            className="text-center text-[13.5px] font-bold text-slate-600 bg-white border border-[#e3e3de] px-4 py-[11px] rounded-[9px] hover:bg-canvas transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSkipDuplicates}
            disabled={newCount === 0}
            className="flex-1 text-center text-[13.5px] font-bold text-primary bg-white border border-primary/40 py-[11px] rounded-[9px] hover:bg-primary-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Skip duplicates ({newCount})
          </button>
          <button
            type="button"
            onClick={onProceedAll}
            className="flex-1 text-center text-[13.5px] font-bold text-white bg-primary py-[11px] rounded-[9px] shadow-button hover:bg-primary-hover transition-colors"
          >
            Create all ({totalCount})
          </button>
        </div>
      </div>
    </div>
  )
}
