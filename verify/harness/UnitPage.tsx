'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { getUnit } from '@/verify/core/registry'
import { runFixture } from '@/verify/core/runner'
import type { VerifyResult } from '@/verify/core/types'
import { setCurrentResult } from './handle'

/**
 * Mount cô lập một unit × fixture tại /verify/[unitId]/[fixtureId].
 * Query: ?chrome=0 ẩn khung kết quả (chỉ còn component — phục vụ screenshot).
 */
export function UnitPage() {
  const params = useParams<{ unitId: string; fixtureId: string }>()
  const searchParams = useSearchParams()
  const showChrome = searchParams.get('chrome') !== '0'

  const unitId = params.unitId
  const fixtureId = params.fixtureId

  const containerRef = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)

  // Unit/fixture derive trực tiếp từ params — registry đã được nạp qua
  // side-effect imports ở page trước khi component này render
  const unit = getUnit(unitId)
  const fixture = unit?.fixtures.find(f => f.id === fixtureId)
  const found = Boolean(unit && fixture)

  useEffect(() => {
    const targetUnit = getUnit(unitId)
    const targetFixture = targetUnit?.fixtures.find(f => f.id === fixtureId)
    if (!targetUnit || !targetFixture || !containerRef.current) return

    let cancelled = false
    runFixture(targetUnit, targetFixture, {
      container: containerRef.current,
      keepMounted: true,
    }).then(r => {
      if (cancelled) return
      setResult(r)
      setCurrentResult(r)
    })
    return () => {
      cancelled = true
      setCurrentResult(null)
    }
  }, [unitId, fixtureId])

  if (!found) {
    return (
      <div className="p-8">
        <p className="text-red-700">{`Không tìm thấy unit "${unitId}" / fixture "${fixtureId}"`}</p>
        <Link href="/verify" className="text-blue-700 hover:underline">← Dashboard</Link>
      </div>
    )
  }

  return (
    <div className={showChrome ? 'mx-auto max-w-3xl p-8' : 'p-4'}>
      {showChrome && (
        <header className="mb-4 flex items-center justify-between">
          <h1 className="font-bold">
            {unitId} <span className="text-gray-400">/</span> {fixtureId}
          </h1>
          <Link href="/verify" className="text-sm text-blue-700 hover:underline">← Dashboard</Link>
        </header>
      )}

      {/* Mount target — runner render component vào đây */}
      <div ref={containerRef} className={showChrome ? 'rounded-lg border border-dashed border-gray-300 p-6' : ''} />

      {showChrome && result && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-sm font-bold">
            Verdict: <span className={result.verdict === 'PASS' ? 'text-green-700' : 'text-red-700'}>{result.verdict}</span>
            <span className="ml-2 font-normal text-gray-400">{result.durationMs}ms</span>
          </p>
          <ul className="space-y-1">
            {result.checks.map((check, i) => (
              <li key={i} className="text-xs">
                <span className={check.status === 'ok' ? 'text-green-700' : check.status === 'fail' ? 'text-red-700' : 'text-gray-500'}>
                  {check.status === 'ok' ? '✓' : check.status === 'fail' ? '✗' : '–'} [{check.verifier}] {check.label}
                </span>
                {check.detail && <span className="text-gray-500"> — {check.detail}</span>}
              </li>
            ))}
          </ul>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-gray-500">DOM contract snapshot</summary>
            <pre className="mt-1 text-xs text-gray-600">{JSON.stringify(result.domSnapshot, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  )
}
