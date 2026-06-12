'use client'

// Side-effect imports — đăng ký toàn bộ verifiers và specs vào registry
import '@/verify/verifiers'
import '@/verify/specs'

import { useEffect } from 'react'
import { notFound } from 'next/navigation'
import { installVerifyHandle } from '@/verify/harness/handle'
import { Dashboard } from '@/verify/harness/Dashboard'

export default function VerifyDashboardPage() {
  useEffect(() => {
    installVerifyHandle()
  }, [])

  // Harness chỉ phục vụ dev — production trả 404
  if (process.env.NODE_ENV === 'production') notFound()

  return <Dashboard />
}
