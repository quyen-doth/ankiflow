'use client'

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

// Shared field wrapper with label
interface FieldWrapperProps {
  label?: string
  error?: string
  className?: string
  children: React.ReactNode
}

export function FieldWrapper({ label, error, className, children }: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-label-sm uppercase tracking-wide text-on-surface-var">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-label-sm text-error">{error}</p>}
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
      'w-full bg-surface-container rounded-lg px-4 py-3',
      'text-body-md text-on-surface placeholder:text-on-surface-var/50',
      'border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'transition-shadow duration-150',
      error && 'ring-2 ring-error/50',
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
      'w-full bg-surface-container rounded-lg px-4 py-3 resize-none',
      'text-body-md text-on-surface placeholder:text-on-surface-var/50',
      'border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'transition-shadow duration-150',
      error && 'ring-2 ring-error/50',
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
        'w-full bg-surface-container border border-transparent rounded-lg px-4 py-3 appearance-none',
        'text-body-md text-on-surface cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        error && 'border-error ring-2 ring-error/30',
        className
      )}
      {...props}
      {...verifyAttrs({ unit: 'Select', error: !!error })}
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-var pointer-events-none" />
  </div>
))
Select.displayName = 'Select'
