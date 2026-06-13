/**
 * Tiện ích dùng chung cho các spec của admin managers (CategoryManager, ...).
 * Không phải file *.verify — không tự đăng ký unit, chỉ export helper.
 */
import type { DocSeed } from '@/verify/core/types'

/** Truy cập store in-memory của firestore stub (chỉ tồn tại trong vitest) */
export function firestoreStore(): Map<string, DocSeed[]> | null {
  const g = globalThis as unknown as { __verifyFirestoreStore?: () => Map<string, DocSeed[]> }
  return g.__verifyFirestoreStore?.() ?? null
}

/** Docs hiện có trong một collection của store (rỗng nếu không có / không ở vitest) */
export function collectionDocs(name: string): DocSeed[] {
  return firestoreStore()?.get(name) ?? []
}

/** Click button đầu tiên có text chứa `text` */
export function clickButtonByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes(text))
  if (!btn) throw new Error(`không tìm thấy button "${text}"`)
  btn.click()
}

/** Tìm FieldWrapper (div bọc label) theo text của label */
function fieldByLabel(root: HTMLElement, label: string): HTMLElement | null {
  const match = Array.from(root.querySelectorAll('label')).find(l => l.textContent?.trim() === label)
  return match?.parentElement ?? null
}

/** Set giá trị input/textarea trong FieldWrapper có label cho trước (controlled input) */
export function setFieldValue(root: HTMLElement, label: string, value: string): void {
  const field = fieldByLabel(root, label)
  const el = field?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  if (!el) throw new Error(`không tìm thấy input cho field "${label}"`)
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Modal đang mở trong DOM hay không (theo contract data-verify-unit="Modal") */
export function modalOpen(root: HTMLElement): boolean {
  return !!root.querySelector('[data-verify-unit="Modal"]')
}

/** Số dòng dữ liệu trong DataTable lồng bên trong manager (đọc contract rows) */
export function tableRows(root: HTMLElement): number | null {
  const table = root.querySelector('[data-verify-unit="DataTable"]')
  const rows = table?.getAttribute('data-verify-rows')
  return rows === null || rows === undefined ? null : Number(rows)
}
