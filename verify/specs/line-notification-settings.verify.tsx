import type { ComponentProps } from 'react'
import { z } from 'zod'
import { LineNotificationSettingsView } from '@/components/settings/LineNotificationSettings'
import { ToastProvider } from '@/components/ui/Toast'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type LineNotificationSettingsProps = ComponentProps<typeof LineNotificationSettingsView>

const noop = () => undefined
let copiedText = ''

const BASE_PROPS: LineNotificationSettingsProps = {
  loading: false,
  available: true,
  linked: false,
  enabled: false,
  linkCode: null,
  remainingSeconds: 0,
  generating: false,
  updating: false,
  sending: false,
  unlinking: false,
  unlinkModalOpen: false,
  scheduleHours: [],
  wordsPerNotification: 5,
  addFriendUrl: 'https://line.me/R/ti/p/%40ankiflow',
  sendCodeUrl: null,
  onGenerateLinkCode: noop,
  onUpdateEnabled: noop,
  onSendTestNotification: noop,
  onOpenUnlinkModal: noop,
  onCloseUnlinkModal: noop,
  onUnlinkLineAccount: noop,
}

const CODE_READY_PROPS: LineNotificationSettingsProps = {
  ...BASE_PROPS,
  linkCode: 'ANKI-ABCDEF',
  remainingSeconds: 545,
  sendCodeUrl: 'https://line.me/R/oaMessage/%40ankiflow/?ANKI-ABCDEF',
}

function expectedState(props: LineNotificationSettingsProps): string {
  if (props.loading) return 'loading'
  if (!props.available) return 'disabled'
  if (props.linked) return 'linked'
  if (props.linkCode) return 'waiting'
  return 'unlinked'
}

registerUnit<LineNotificationSettingsProps>({
  id: 'LineNotificationSettings',
  title: 'LINE notification settings',
  description: 'LINE 連携の mobile-first steps、code copy、waiting、linked/disabled 状態。',
  kind: 'feature',
  render: props => (
    <ToastProvider>
      <LineNotificationSettingsView {...props} />
    </ToastProvider>
  ),
  propsSchema: z.object({
    loading: z.boolean(),
    available: z.boolean(),
    linked: z.boolean(),
    enabled: z.boolean(),
    linkCode: z.string().nullable(),
    remainingSeconds: z.number(),
    generating: z.boolean(),
    updating: z.boolean(),
    sending: z.boolean(),
    unlinking: z.boolean(),
    unlinkModalOpen: z.boolean(),
    scheduleHours: z.array(z.number()),
    wordsPerNotification: z.number(),
    addFriendUrl: z.string().nullable(),
    sendCodeUrl: z.string().nullable(),
    onGenerateLinkCode: fn(),
    onUpdateEnabled: fn(),
    onSendTestNotification: fn(),
    onOpenUnlinkModal: fn(),
    onCloseUnlinkModal: fn(),
    onUnlinkLineAccount: fn(),
  }),
  fixtures: [
    {
      id: 'unlinked-steps',
      description: '未連携: 3 steps、add-friend primary action、code generation を表示する。',
      props: BASE_PROPS,
    },
    {
      id: 'code-ready',
      description: 'Code 生成済み: copy、mobile send deep link、countdown、waiting state を表示する。',
      props: CODE_READY_PROPS,
    },
    {
      id: 'act-copy-code',
      description: 'Copy を押すと code を clipboard に書き込み、Copied feedback を表示する。',
      props: CODE_READY_PROPS,
      act: async ctx => {
        copiedText = ''
        const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (value: string) => {
              copiedText = value
            },
          },
        })
        try {
          await ctx.click('button')
        } finally {
          if (originalClipboard) {
            Object.defineProperty(navigator, 'clipboard', originalClipboard)
          } else {
            Reflect.deleteProperty(navigator, 'clipboard')
          }
        }
      },
    },
    {
      id: 'linked-enabled',
      description: '連携済み: Linked badge、reminder toggle、schedule、test send を維持する。',
      props: {
        ...BASE_PROPS,
        linked: true,
        enabled: true,
        scheduleHours: [8, 20],
      },
    },
    {
      id: 'admin-disabled',
      description: '管理者 disabled: 既存の availability message だけを表示する。',
      props: { ...BASE_PROPS, available: false },
    },
    {
      id: 'probe-missing-bot-config',
      probe: true,
      description: 'Probe: add-friend URL と bot ID が未設定でも action が無言で消えない。',
      props: { ...BASE_PROPS, addFriendUrl: null },
    },
  ],
  invariants: [
    {
      id: 'state-contract-matches',
      description: '公開 state contract が props から導出した状態と一致する。',
      check: ({ contract, props }) =>
        contract.state === expectedState(props) ||
        `state=${contract.state}, expected=${expectedState(props)}`,
    },
    {
      id: 'unlinked-shows-three-steps',
      description: '未連携状態は 3-step guide と generate action を表示する。',
      onlyFixtures: ['unlinked-steps'],
      check: ({ root }) => {
        const step = root.querySelector('[data-verify-unit="StepIndicator"]')
        if (!step || step.children.length !== 3) return '3-step guide が見つかりません'
        return (root.textContent ?? '').includes('Generate code') || 'Generate code が見つかりません'
      },
    },
    {
      id: 'configured-links-are-exact',
      description: 'add-friend/send-code links は設定済み URL をそのまま公開する。',
      onlyFixtures: ['unlinked-steps', 'code-ready'],
      check: ({ root, props, fixture }) => {
        if (fixture.id === 'unlinked-steps') {
          return root.querySelector('a')?.getAttribute('href') === props.addFriendUrl || 'add-friend href mismatch'
        }
        const sendLink = Array.from(root.querySelectorAll('a')).find(link =>
          link.textContent?.includes('send code'),
        )
        return sendLink?.getAttribute('href') === props.sendCodeUrl || 'send-code href mismatch'
      },
    },
    {
      id: 'waiting-shows-code-countdown-and-status',
      description: 'Code ready は code、09:05 countdown、aria-live waiting status を表示する。',
      onlyFixtures: ['code-ready', 'act-copy-code'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('ANKI-ABCDEF')) return 'code が見つかりません'
        if (!text.includes('09:05')) return 'countdown が見つかりません'
        const status = root.querySelector('[role="status"][aria-live="polite"]')
        return status?.textContent?.includes('Waiting for your message') || 'waiting status が見つかりません'
      },
    },
    {
      id: 'copy-writes-exact-code',
      description: 'Copy action は表示中の code を正確に clipboard へ渡す。',
      onlyFixtures: ['act-copy-code'],
      check: ({ root }) =>
        (copiedText === 'ANKI-ABCDEF' && (root.textContent ?? '').includes('Copied')) ||
        `copiedText=${copiedText}`,
    },
    {
      id: 'linked-state-preserved',
      description: 'Linked state は badge、toggle、schedule を維持する。',
      onlyFixtures: ['linked-enabled'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        return (
          text.includes('Linked ✓') &&
          text.includes('08:00, 20:00') &&
          Boolean(root.querySelector('[role="switch"]'))
        ) || 'linked UI が不足しています'
      },
    },
    {
      id: 'admin-disabled-hides-linking-actions',
      description: 'Admin disabled は linking actions を表示しない。',
      onlyFixtures: ['admin-disabled'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        return (
          text.includes('disabled by administrator') &&
          !text.includes('Generate code') &&
          !text.includes('Open LINE')
        ) || 'disabled state に不要な action があります'
      },
    },
    {
      id: 'missing-config-is-explicit',
      description: 'Bot config 不足時は明示的な案内を表示する。',
      onlyFixtures: ['probe-missing-bot-config'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('LINE bot link is not configured') ||
        'missing-config guidance が見つかりません',
    },
  ],
})
