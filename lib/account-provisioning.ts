import { getAdminAuthInstance, getAdminDb } from '@/lib/firebase-admin'
import { seedUserDefaults } from '@/lib/seed-defaults'

export type AccountProvisioningStep = 'admin-claim' | 'seed-defaults'

export interface AccountProvisioningWarning {
  step: AccountProvisioningStep
  error: unknown
}

export interface AccountProvisioningInput {
  email: string
  password: string
}

export interface AccountProvisioningResult {
  uid: string
  warnings: AccountProvisioningWarning[]
}

/** Firebase Auth user を作成し、管理者 claim とユーザー既定値を best-effort で適用する。 */
export async function provisionUserAccount(
  input: AccountProvisioningInput,
): Promise<AccountProvisioningResult> {
  const adminAuth = getAdminAuthInstance()
  const user = await adminAuth.createUser({ email: input.email, password: input.password })
  const warnings: AccountProvisioningWarning[] = []

  if (process.env.ADMIN_EMAIL && input.email === process.env.ADMIN_EMAIL) {
    try {
      await adminAuth.setCustomUserClaims(user.uid, { admin: true })
    } catch (error) {
      warnings.push({ step: 'admin-claim', error })
    }
  }

  try {
    await seedUserDefaults(getAdminDb(), user.uid)
  } catch (error) {
    warnings.push({ step: 'seed-defaults', error })
  }

  return { uid: user.uid, warnings }
}
