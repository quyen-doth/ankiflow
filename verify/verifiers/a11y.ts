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
  description: 'Kiểm tra a11y cơ bản: button có tên, input có label, img có alt.',
  run({ root }): Check[] {
    const checks: Check[] = []

    const buttons = Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]'))
    const unnamedButtons = buttons.filter(b => !hasAccessibleName(b))
    checks.push(
      unnamedButtons.length === 0
        ? { verifier: 'a11y', status: 'ok', label: `Mọi button có tên truy cập được (${buttons.length})` }
        : {
            verifier: 'a11y',
            status: 'fail',
            label: `${unnamedButtons.length}/${buttons.length} button thiếu accessible name`,
            detail: unnamedButtons.map(b => b.outerHTML.slice(0, 120)).join('\n'),
          }
    )

    const inputs = Array.from(
      root.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea, select')
    )
    const unlabeled = inputs.filter(i => !inputHasLabel(i, root))
    checks.push(
      unlabeled.length === 0
        ? { verifier: 'a11y', status: 'ok', label: `Mọi input có label (${inputs.length})` }
        : {
            verifier: 'a11y',
            status: 'fail',
            label: `${unlabeled.length}/${inputs.length} input thiếu label`,
            detail: unlabeled.map(i => i.outerHTML.slice(0, 120)).join('\n'),
          }
    )

    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
    const noAlt = images.filter(img => !img.hasAttribute('alt'))
    checks.push(
      noAlt.length === 0
        ? { verifier: 'a11y', status: 'ok', label: `Mọi img có alt (${images.length})` }
        : {
            verifier: 'a11y',
            status: 'fail',
            label: `${noAlt.length}/${images.length} img thiếu alt`,
            detail: noAlt.map(i => i.outerHTML.slice(0, 120)).join('\n'),
          }
    )

    return checks
  },
})
