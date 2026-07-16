import { LoginForm } from '@/components/auth/LoginForm'
import { isPublicSignupEnabled } from '@/lib/signup-policy'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm signupEnabled={isPublicSignupEnabled()} />
}
