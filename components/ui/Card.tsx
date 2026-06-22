import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={cn('bg-white rounded-card border border-border p-6', className)}
      {...verifyAttrs({ unit: 'Card' })}
      {...rest}
    >
      {children}
    </div>
  )
}
