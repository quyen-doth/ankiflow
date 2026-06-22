import { verifyAttrs } from '@/verify/core/contract'

interface ErrorMessageProps {
  message: string | null
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null
  return (
    <div
      className="mb-4 px-4 py-3 bg-danger-bg border border-danger/30 rounded-card text-sm text-danger"
      {...verifyAttrs({ unit: 'ErrorMessage' })}
    >
      ⚠️ {message}
    </div>
  )
}
