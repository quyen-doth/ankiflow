import { useState, type ComponentProps } from 'react'
import { z } from 'zod'
import { NewTopicModal } from '@/components/create/NewTopicModal'
import { ToastProvider } from '@/components/ui/Toast'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { clickButtonByText } from '@/verify/specs/manager-helpers'

type NewTopicModalProps = ComponentProps<typeof NewTopicModal>

const modalSpy = {
  createdNames: [] as string[],
  closeCount: 0,
}

function resetSpy(): void {
  modalSpy.createdNames = []
  modalSpy.closeCount = 0
}

async function createTopic(name: string): Promise<void> {
  modalSpy.createdNames.push(name)
}

async function failToCreateTopic(name: string): Promise<void> {
  modalSpy.createdNames.push(name)
  throw new Error('Simulated Firestore failure')
}

function recordClose(): void {
  modalSpy.closeCount += 1
}

function noop(): void {}

function NewTopicModalHarness(props: NewTopicModalProps) {
  const [open, setOpen] = useState(props.open)
  const [createdName, setCreatedName] = useState('')

  return (
    <ToastProvider>
      <NewTopicModal
        open={open}
        onClose={() => {
          setOpen(false)
          props.onClose()
        }}
        onCreate={async name => {
          await props.onCreate(name)
          setCreatedName(name)
        }}
      />
      <output aria-label="Created topic">{createdName}</output>
    </ToastProvider>
  )
}

registerUnit<NewTopicModalProps>({
  id: 'NewTopicModal',
  title: 'NewTopicModal',
  description: 'Topic 名だけを入力して Create ページ内から作成する modal。',
  kind: 'component',
  render: props => <NewTopicModalHarness {...props} />,
  propsSchema: z.object({
    open: z.boolean(),
    onClose: fn<() => void>(),
    onCreate: fn<(name: string) => Promise<void>>(),
  }),
  fixtures: [
    {
      id: 'open-basic',
      description: 'Topic name input と操作 button を表示する。',
      props: { open: true, onClose: noop, onCreate: createTopic },
    },
    {
      id: 'create-success',
      description: '名前を trim して作成し、成功後に modal を閉じる。',
      props: { open: true, onClose: recordClose, onCreate: createTopic },
      act: async ctx => {
        resetSpy()
        await ctx.type('input[aria-label="Topic name"]', '  Distributed Systems  ')
        clickButtonByText(ctx.root, 'Create topic')
        await ctx.wait(20)
      },
    },
    {
      id: 'create-error',
      description: '保存失敗時は modal を維持し、再試行できる。',
      props: { open: true, onClose: recordClose, onCreate: failToCreateTopic },
      act: async ctx => {
        resetSpy()
        await ctx.type('input[aria-label="Topic name"]', 'Cloud Security')
        clickButtonByText(ctx.root, 'Create topic')
        await ctx.wait(20)
      },
    },
    {
      id: 'e2e-create-success',
      description: 'Playwright が UI 操作を担当する成功 fixture。',
      props: { open: true, onClose: recordClose, onCreate: createTopic },
    },
    {
      id: 'e2e-create-error',
      description: 'Playwright が UI 操作を担当する失敗 fixture。',
      props: { open: true, onClose: recordClose, onCreate: failToCreateTopic },
    },
    {
      id: 'probe-empty-name',
      probe: true,
      description: '空白だけの名前では作成 button が無効になる。',
      props: { open: true, onClose: recordClose, onCreate: createTopic },
      act: async ctx => {
        resetSpy()
        await ctx.type('input[aria-label="Topic name"]', '   ')
      },
    },
  ],
  invariants: [
    {
      id: 'name-only-form',
      description: 'Topic name 以外の入力フィールドを要求しない',
      onlyFixtures: ['open-basic'],
      check: ({ root }) => {
        const inputs = root.querySelectorAll('input')
        if (inputs.length !== 1) return `inputs=${inputs.length}`
        return inputs[0].getAttribute('aria-label') === 'Topic name' || 'Topic name input がない'
      },
    },
    {
      id: 'success-closes-with-trimmed-name',
      description: '成功時に trim 済み name を渡して閉じる',
      onlyFixtures: ['create-success'],
      check: ({ root }) => {
        if (JSON.stringify(modalSpy.createdNames) !== JSON.stringify(['Distributed Systems'])) {
          return `createdNames=${JSON.stringify(modalSpy.createdNames)}`
        }
        if (modalSpy.closeCount !== 1) return `closeCount=${modalSpy.closeCount}`
        const output = root.querySelector('output[aria-label="Created topic"]')
        return output?.textContent === 'Distributed Systems' || `output=${output?.textContent}`
      },
    },
    {
      id: 'failure-keeps-modal-open',
      description: '保存失敗時は modal と入力値を維持して error toast を表示する',
      onlyFixtures: ['create-error'],
      check: ({ root }) => {
        if (modalSpy.closeCount !== 0) return `closeCount=${modalSpy.closeCount}`
        if (!root.querySelector('input[aria-label="Topic name"]')) return 'modal が閉じた'
        return (root.textContent ?? '').includes('Failed to create the topic. Please try again.') ||
          'error toast がない'
      },
    },
    {
      id: 'empty-name-disabled',
      description: '空白だけの場合は Create topic が disabled',
      onlyFixtures: ['probe-empty-name'],
      check: ({ root }) => {
        const button = Array.from(root.querySelectorAll('button')).find(item => item.textContent?.includes('Create topic'))
        return button?.hasAttribute('disabled') || 'Create topic button が有効'
      },
    },
  ],
})
