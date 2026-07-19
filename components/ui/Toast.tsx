'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toastItem } from '@/lib/motion'
import { verifyAttrs } from '@/verify/core/contract'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  variant: ToastVariant
  message: string
}

interface ToastFns {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const noop = () => undefined
const ToastContext = createContext<ToastFns>({ success: noop, error: noop, warning: noop, info: noop })

/** どの component でも使用可: const toast = useToast(); toast.success('...') */
export function useToast(): ToastFns {
  return useContext(ToastContext)
}

const VARIANT_STYLE: Record<ToastVariant, { box: string; icon: string; Icon: typeof CheckCircle }> = {
  success: { box: 'bg-[#f1f7f3] border-[#d8e6dd]', icon: 'text-primary', Icon: CheckCircle },
  error: { box: 'bg-[#fbf0ef] border-[#f0d4d0]', icon: 'text-danger', Icon: XCircle },
  warning: { box: 'bg-[#faf3e6] border-[#efe0c6]', icon: 'text-[#b87514]', Icon: AlertTriangle },
  info: { box: 'bg-white border-border', icon: 'text-slate-600', Icon: Info },
}

/** 単一 toast (純粋な表示のみ)。 */
export function Toast({ variant, message, onClose }: { variant: ToastVariant; message: string; onClose: () => void }) {
  const s = VARIANT_STYLE[variant]
  const Icon = s.Icon
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 px-4 py-3 rounded-[10px] border min-w-[280px] max-w-[380px]',
        'shadow-[0_8px_24px_rgba(0,0,0,0.1)]',
        s.box,
      )}
      {...verifyAttrs({ unit: 'Toast', variant })}
    >
      <Icon className={cn('w-[18px] h-[18px] flex-shrink-0 mt-px', s.icon)} />
      <p className="flex-1 text-[13.5px] font-medium text-ink leading-snug">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="text-slate-400 hover:text-ink flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++counter
      setToasts((list) => [...list, { id, variant, message }])
      setTimeout(() => remove(id), 4000)
    },
    [remove],
  )

  const fns = useMemo<ToastFns>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      warning: (m) => push('warning', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={fns}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              variants={toastItem}
              initial="hidden"
              animate="show"
              exit="exit"
              className="pointer-events-auto"
            >
              <Toast variant={t.variant} message={t.message} onClose={() => remove(t.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
