'use client'

import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

// Shared field wrapper with label
interface FieldWrapperProps extends HTMLAttributes<HTMLDivElement> {
  label?: string
  error?: string
  className?: string
  children: React.ReactNode
}

export function FieldWrapper({ label, error, className, children, ...rest }: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...rest}>
      {label && (
        <label className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-overline text-danger">{error}</p>}
    </div>
  )
}

// Text Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ error, className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full h-[42px] bg-[#FCFCFB] rounded-[9px] px-4',
      'text-body text-ink placeholder:text-slate-400/60',
      'border border-[#E3E3DE] focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg',
      'transition-shadow duration-150',
      error && 'border-danger ring-[3px] ring-danger-bg',
      className
    )}
    {...props}
    {...verifyAttrs({ unit: 'Input', error: !!error })}
  />
))
Input.displayName = 'Input'

// Textarea
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ error, className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full bg-[#FCFCFB] rounded-[9px] px-4 py-3 resize-none',
      'text-body text-ink placeholder:text-slate-400/60',
      'border border-[#E3E3DE] focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg',
      'transition-shadow duration-150',
      error && 'border-danger ring-[3px] ring-danger-bg',
      className
    )}
    {...props}
    {...verifyAttrs({ unit: 'Textarea', error: !!error })}
  />
))
Textarea.displayName = 'Textarea'

// Select
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ error, className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'w-full h-[42px] bg-[#FCFCFB] border border-[#E3E3DE] rounded-[9px] px-4 appearance-none',
        'text-body text-ink cursor-pointer',
        'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg',
        error && 'border-danger ring-[3px] ring-danger-bg',
        className
      )}
      {...props}
      {...verifyAttrs({ unit: 'Select', error: !!error })}
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
  </div>
))
Select.displayName = 'Select'
