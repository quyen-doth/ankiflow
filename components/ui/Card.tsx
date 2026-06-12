import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn('bg-white rounded-xl shadow-card border border-outline-var/40 p-6', className)}
      {...verifyAttrs({ unit: 'Card' })}
    >
      {children}
    </div>
  )
}
