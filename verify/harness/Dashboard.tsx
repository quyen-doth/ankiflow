'use client'

import { useState } from 'react'
import Link from 'next/link'
import { allUnits, allVerifiers, buildManifest } from '@/verify/core/registry'
import { runUnit } from '@/verify/core/runner'
import type { Verdict, VerifyResult } from '@/verify/core/types'

const verdictStyles: Record<Verdict, string> = {
  PASS: 'bg-green-100 text-green-800',
  FAIL: 'bg-red-100 text-red-800',
  BLOCKED: 'bg-orange-100 text-orange-800',
  SKIP: 'bg-gray-100 text-gray-500',
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${verdictStyles[verdict]}`}>
      {verdict}
    </span>
  )
}

export function Dashboard() {
  const [results, setResults] = useState<Map<string, VerifyResult>>(new Map())
  const [running, setRunning] = useState(false)

  const units = allUnits()
  const verifiers = allVerifiers()

  const runAll = async () => {
    setRunning(true)
    const next = new Map<string, VerifyResult>()
    try {
      for (const unit of units) {
        for (const result of await runUnit(unit)) {
          next.set(`${result.unitId}::${result.fixtureId}`, result)
        }
        setResults(new Map(next))
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verify Dashboard</h1>
          <p className="text-sm text-gray-500">
            {units.length} units · {units.reduce((n, u) => n + u.fixtures.length, 0)} fixtures ·{' '}
            {verifiers.length} verifiers ({verifiers.map(v => v.id).join(', ')})
          </p>
        </div>
        <button
          type="button"
          onClick={runAll}
          disabled={running}
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {running ? 'Running…' : 'Run all'}
        </button>
      </div>

      {units.map(unit => (
        <section key={unit.id} className="mb-6 rounded-lg border border-gray-200 bg-white">
          <header className="border-b border-gray-100 px-4 py-3">
            <h2 className="font-bold">
              {unit.title}{' '}
              <span className="ml-1 text-xs font-normal text-gray-400">{unit.kind}</span>
            </h2>
            {unit.description && <p className="text-xs text-gray-500">{unit.description}</p>}
          </header>
          <ul>
            {unit.fixtures.map(fixture => {
              const result = results.get(`${unit.id}::${fixture.id}`)
              const failed = result?.checks.filter(c => c.status === 'fail') ?? []
              return (
                <li key={fixture.id} className="flex items-start gap-3 border-b border-gray-50 px-4 py-2 last:border-b-0">
                  <div className="w-20 shrink-0 pt-0.5">
                    {result ? <VerdictBadge verdict={result.verdict} /> : <span className="text-xs text-gray-300">—</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/verify/${unit.id}/${fixture.id}`}
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      {fixture.id}
                    </Link>
                    {fixture.probe && (
                      <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-purple-700">
                        probe
                      </span>
                    )}
                    <p className="truncate text-xs text-gray-500">{fixture.description}</p>
                    {result?.blockedReason && (
                      <p className="text-xs text-orange-700">blocked: {result.blockedReason}</p>
                    )}
                    {result?.skipReason && (
                      <p className="text-xs text-gray-500">skip: {result.skipReason}</p>
                    )}
                    {failed.map((check, i) => (
                      <p key={i} className="text-xs text-red-700">
                        ✗ [{check.verifier}] {check.label}
                        {check.detail ? ` — ${check.detail}` : ''}
                      </p>
                    ))}
                  </div>
                  {result && (
                    <span className="shrink-0 pt-0.5 text-[10px] text-gray-400">{result.durationMs}ms</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <details className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <summary className="cursor-pointer text-sm font-bold text-gray-600">
          Manifest (agent 用 — window.__verify.manifest() からもアクセス可能)
        </summary>
        <pre className="mt-2 overflow-auto text-xs text-gray-600">
          {JSON.stringify(buildManifest(), null, 2)}
        </pre>
      </details>
    </div>
  )
}
