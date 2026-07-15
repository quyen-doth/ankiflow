'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FieldWrapper, Input } from '@/components/ui/FormField'
import { signIn } from '@/lib/auth'
import { verifyAttrs } from '@/verify/core/contract'

interface LoginFormProps {
  signupEnabled: boolean
}

export function LoginForm({ signupEnabled }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await signIn(email.trim(), password)
      if (result.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(result.error || 'Sign in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="bg-surface border border-border rounded-[14px] p-7 sm:p-8"
      {...verifyAttrs({ unit: 'LoginForm', signupEnabled })}
    >
      <h1 className="text-[20px] font-extrabold text-ink mb-1">Welcome back</h1>
      <p className="text-[13px] text-slate-600 mb-6">Sign in to continue to AnkiFlow.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FieldWrapper label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </FieldWrapper>

        <FieldWrapper label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        </FieldWrapper>

        {error && (
          <p className="text-[12.5px] text-danger bg-danger-bg rounded-[9px] px-3 py-2">{error}</p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={loading || !email.trim() || !password}
          leftIcon={<LogIn className="w-4 h-4" />}
          className="w-full mt-1"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {signupEnabled && (
        <p className="text-[12.5px] text-slate-600 mt-5 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-bold text-primary hover:underline">
            Create account
          </Link>
        </p>
      )}
    </div>
  )
}
