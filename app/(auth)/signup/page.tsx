import { SignupClosed } from '@/components/auth/SignupClosed'
import { SignupForm } from '@/components/auth/SignupForm'
import { isPublicSignupEnabled } from '@/lib/signup-policy'

export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return isPublicSignupEnabled() ? <SignupForm /> : <SignupClosed />
}
