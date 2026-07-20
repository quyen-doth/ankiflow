/**
 * 検証用コメント。
 * 検証用コメント。
 */
import type { DocSeed } from '@/verify/core/types'

/** firestore stub の in-memory store へアクセスする (vitest 内のみ存在) */
export function firestoreStore(): Map<string, DocSeed[]> | null {
  const g = globalThis as unknown as { __verifyFirestoreStore?: () => Map<string, DocSeed[]> }
  return g.__verifyFirestoreStore?.() ?? null
}

/** store の collection に存在する docs (存在しない場合 / vitest 以外では空) */
export function collectionDocs(name: string): DocSeed[] {
  return firestoreStore()?.get(name) ?? []
}

/** `text` を含む最初の button を click する */
export function clickButtonByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes(text))
  if (!btn) throw new Error(`button が見つかりません "${text}"`)
  btn.click()
}

/** label text から FieldWrapper (label を包む div) を探す */
function fieldByLabel(root: HTMLElement, label: string): HTMLElement | null {
  const match = Array.from(root.querySelectorAll('label')).find(l => l.textContent?.trim() === label)
  return match?.parentElement ?? null
}

/** 指定 label を持つ FieldWrapper 内の input/textarea value を設定する (controlled input) */
export function setFieldValue(root: HTMLElement, label: string, value: string): void {
  const field = fieldByLabel(root, label)
  const el = field?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  if (!el) throw new Error(`field の input が見つかりません "${label}"`)
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** DOM 内で modal が開いているか (contract data-verify-unit="Modal" 基準) */
export function modalOpen(root: HTMLElement): boolean {
  return !!root.querySelector('[data-verify-unit="Modal"]')
}

/** manager 内の DataTable 行数 (contract rows から読む) */
export function tableRows(root: HTMLElement): number | null {
  const table = root.querySelector('[data-verify-unit="DataTable"]')
  const rows = table?.getAttribute('data-verify-rows')
  return rows === null || rows === undefined ? null : Number(rows)
}
