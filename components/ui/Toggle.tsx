'use client'

import { verifyAttrs } from '@/verify/core/contract'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  /** Render only the row (label + switch) without the default boxed container. */
  bare?: boolean
}

export function Toggle({ checked, onChange, label, description, disabled, bare }: ToggleProps) {
  return (
    <div
      className={
        bare
          ? 'flex items-center justify-between gap-4'
          : 'flex items-center justify-between py-4 px-5 bg-white rounded-[9px] border border-border'
      }
      {...verifyAttrs({ unit: 'Toggle', checked, disabled: !!disabled })}
    >
      <div className="flex-1 mr-4">
        <p className={bare ? 'text-[14px] font-bold text-ink' : 'text-sm font-semibold text-ink'}>{label}</p>
        {description && <p className={bare ? 'text-[12.5px] text-slate-400 mt-0.5' : 'text-secondary text-slate-400 mt-0.5'}>{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-[42px] flex-shrink-0 cursor-pointer rounded-pill
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg
          disabled:opacity-40 disabled:cursor-not-allowed
          ${checked ? 'bg-primary' : 'bg-[#DCDCD7]'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white
            transition duration-200 ease-in-out mt-0.5
            ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}
          `}
          style={{ boxShadow: checked ? 'none' : '0 1px 2px rgba(0,0,0,.2)' }}
        />
      </button>
    </div>
  )
}
