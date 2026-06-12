'use client'

// Side-effect imports — đăng ký toàn bộ verifiers và specs vào registry
import '@/verify/verifiers'
import '@/verify/specs'

import { Suspense, useEffect } from 'react'
import { notFound } from 'next/navigation'
import { installVerifyHandle } from '@/verify/harness/handle'
import { UnitPage } from '@/verify/harness/UnitPage'

export default function VerifyUnitPage() {
  useEffect(() => {
    installVerifyHandle()
  }, [])

  // Harness chỉ phục vụ dev — production trả 404
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    // useSearchParams trong UnitPage yêu cầu Suspense boundary khi prerender
    <Suspense fallback={null}>
      <UnitPage />
    </Suspense>
  )
}
