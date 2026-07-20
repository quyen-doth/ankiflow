import { registerVerifier } from '@/verify/core/registry'
import type { Check } from '@/verify/core/types'

function hasAccessibleName(el: HTMLElement): boolean {
  if (el.getAttribute('aria-label')?.trim()) return true
  if (el.getAttribute('aria-labelledby')) return true
  if (el.textContent?.trim()) return true
  if (el.getAttribute('title')?.trim()) return true
  return false
}

function inputHasLabel(input: HTMLElement, root: HTMLElement): boolean {
  if (input.getAttribute('aria-label')?.trim()) return true
  if (input.getAttribute('aria-labelledby')) return true
  if (input.closest('label')) return true
  const id = input.getAttribute('id')
  if (id && root.querySelector(`label[for="${id}"]`)) return true
  if (input.getAttribute('placeholder')?.trim()) return true
  return false
}

export const a11yVerifier = registerVerifier({
  id: 'a11y',
  description: '検証ケース。',
  run({ root }): Check[] {
    const checks: Check[] = []

    const buttons = Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]'))
    const unnamedButtons = buttons.filter(b => !hasAccessibleName(b))
    checks.push(
      unnamedButtons.length === 0
        ? { verifier: 'a11y', status: 'ok', label: `すべての button に accessible name があります (${buttons.length})` }
        : {
            verifier: 'a11y',
            status: 'fail',
            label: `不足しています`,
            detail: unnamedButtons.map(b => b.outerHTML.slice(0, 120)).join('\n'),
          }
    )

    const inputs = Array.from(
      root.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea, select')
    )
    const unlabeled = inputs.filter(i => !inputHasLabel(i, root))
    checks.push(
      unlabeled.length === 0
        ? { verifier: 'a11y', status: 'ok', label: `すべての input に label があります (${inputs.length})` }
        : {
            verifier: 'a11y',
            status: 'fail',
            label: `不足しています`,
            detail: unlabeled.map(i => i.outerHTML.slice(0, 120)).join('\n'),
          }
    )

    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
    const noAlt = images.filter(img => !img.hasAttribute('alt'))
    checks.push(
      noAlt.length === 0
        ? { verifier: 'a11y', status: 'ok', label: `すべての img に alt があります (${images.length})` }
        : {
            verifier: 'a11y',
            status: 'fail',
            label: `不足しています`,
            detail: noAlt.map(i => i.outerHTML.slice(0, 120)).join('\n'),
          }
    )

    return checks
  },
})
