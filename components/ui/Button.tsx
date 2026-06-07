'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses = {
  primary:     'bg-primary text-on-primary hover:bg-primary-container active:scale-[0.98]',
  secondary:   'bg-primary/10 text-primary hover:bg-primary/15 active:scale-[0.98]',
  ghost:       'border border-outline-var text-on-surface-var hover:bg-surface-container active:scale-[0.98]',
  destructive: 'bg-error-container text-on-error border border-error/20 hover:bg-error hover:text-white active:scale-[0.98]',
}

const sizeClasses = {
  sm: 'px-3.5 py-1.5 text-label-sm gap-1.5',
  md: 'px-5 py-2.5 text-label-lg gap-2',
  lg: 'px-6 py-3 text-base gap-2',
  xl: 'px-10 py-4 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

Button.displayName = 'Button'
