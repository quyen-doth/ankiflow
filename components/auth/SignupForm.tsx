'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FieldWrapper, Input } from '@/components/ui/FormField'
import { signUp, emailSchema, passwordSchema } from '@/lib/auth'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const emailCheck = emailSchema.safeParse(email.trim())
    if (!emailCheck.success) {
      setError(emailCheck.error.issues[0].message)
      return
    }
    const passwordCheck = passwordSchema.safeParse(password)
    if (!passwordCheck.success) {
      setError(passwordCheck.error.issues[0].message)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const result = await signUp(email.trim(), password)
      if (result.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(result.error || 'Sign up failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-[14px] p-7 sm:p-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">Create your account</h1>
      <p className="text-[13px] text-slate-600 mb-6">
        Start building your flashcard collection.
      </p>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            required
          />
        </FieldWrapper>

        <FieldWrapper label="Confirm password">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
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
          disabled={loading || !email.trim() || !password || !confirm}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="w-full mt-1"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-[12.5px] text-slate-600 mt-5 text-center">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
