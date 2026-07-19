'use client'

// Side-effect imports — 全 verifiers と specs を registry に登録
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

  // Harness は dev 専用 — production では 404 を返す
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    // UnitPage の useSearchParams は prerender 時に Suspense boundary を要求する
    <Suspense fallback={null}>
      <UnitPage />
    </Suspense>
  )
}
