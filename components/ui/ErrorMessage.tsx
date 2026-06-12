import { verifyAttrs } from '@/verify/core/contract'

interface ErrorMessageProps {
  message: string | null
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null
  return (
    <div
      className="mb-4 px-4 py-3 bg-error-container border border-error/30 rounded-xl text-sm text-on-error"
      {...verifyAttrs({ unit: 'ErrorMessage' })}
    >
      ⚠️ {message}
    </div>
  )
}
