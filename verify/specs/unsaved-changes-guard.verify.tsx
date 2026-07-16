import { z } from 'zod'
import Link from 'next/link'
import { UnsavedChangesProvider } from '@/components/providers/UnsavedChangesProvider'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { verifyAttrs } from '@/verify/core/contract'
import { registerUnit } from '@/verify/core/registry'

interface UnsavedChangesGuardProps {
  dirty: boolean
}

function GuardFixture({ dirty }: UnsavedChangesGuardProps) {
  useUnsavedChangesGuard(dirty)

  return (
    <div {...verifyAttrs({ unit: 'UnsavedChangesGuard', dirty })}>
      <button type="button">Edit setting</button>
      <Link href="/verify/Modal/open-basic?chrome=0">Leave page</Link>
    </div>
  )
}

registerUnit<UnsavedChangesGuardProps>({
  id: 'UnsavedChangesGuard',
  title: 'Unsaved changes guard',
  description: '未保存変更がある画面からの離脱確認を検証する。',
  kind: 'feature',
  render: props => (
    <UnsavedChangesProvider>
      <GuardFixture {...props} />
    </UnsavedChangesProvider>
  ),
  propsSchema: z.object({ dirty: z.boolean() }),
  fixtures: [
    {
      id: 'clean',
      description: '変更がない状態では通常どおり遷移する。',
      props: { dirty: false },
    },
    {
      id: 'dirty',
      probe: true,
      description: '変更がある状態では離脱確認を表示する。',
      props: { dirty: true },
    },
  ],
  invariants: [
    {
      id: 'root-contract',
      description: 'dirty 状態を contract に公開する',
      check: ({ contract, props }) => (
        contract.unit === 'UnsavedChangesGuard'
        && contract.dirty === String(props.dirty)
      ) || `contract=${JSON.stringify(contract)}`,
    },
    {
      id: 'navigation-link-present',
      description: '離脱確認用リンクを表示する',
      check: ({ root }) => (
        root.querySelector('a')?.textContent === 'Leave page'
      ) || 'Leave page link が見つかりません',
    },
    {
      id: 'modal-closed-initially',
      description: '操作前は確認 modal を表示しない',
      check: ({ root }) => (
        root.querySelector('[data-verify-unit="Modal"]') === null
      ) || '操作前に modal が表示されています',
    },
  ],
})
