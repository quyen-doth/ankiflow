'use client'

import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { Bell, Check, Copy, ExternalLink, Link2, Send, Unlink as UnlinkIcon } from 'lucide-react'
import { InfoCallout } from '@/components/create/InfoCallout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useGlobalConfig } from '@/components/providers/GlobalConfigProvider'
import { SectionHeader } from '@/components/settings/SettingsPrimitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { db } from '@/lib/firebase'
import { buildLineAddFriendUrl, buildLineSendCodeUrl } from '@/lib/line/deep-link'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface UserLineSettings {
  line_user_id?: string
  line_notifications_enabled?: boolean
}

interface LineApiResponse {
  code?: string
  expires_at?: string
  error?: string
  message?: string
  sent?: number
}

const LINE_ADD_FRIEND_URL = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL
const LINE_BOT_ID = process.env.NEXT_PUBLIC_LINE_BOT_ID

async function readResponse(response: Response): Promise<LineApiResponse> {
  return response.json().catch(() => ({})) as Promise<LineApiResponse>
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

interface LineNotificationSettingsViewProps {
  loading: boolean
  available: boolean
  linked: boolean
  enabled: boolean
  linkCode: string | null
  remainingSeconds: number
  generating: boolean
  updating: boolean
  sending: boolean
  unlinking: boolean
  unlinkModalOpen: boolean
  scheduleHours: number[]
  wordsPerNotification: number
  addFriendUrl: string | null
  sendCodeUrl: string | null
  onGenerateLinkCode: () => void | Promise<void>
  onUpdateEnabled: (enabled: boolean) => void | Promise<void>
  onSendTestNotification: () => void | Promise<void>
  onOpenUnlinkModal: () => void
  onCloseUnlinkModal: () => void
  onUnlinkLineAccount: () => void | Promise<void>
}

function LineActionLink({
  href,
  children,
  variant = 'primary',
  mobileOnly = false,
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  mobileOnly?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'items-center justify-center gap-1.5 px-3 py-2 rounded-[9px] text-[12px] font-bold transition-colors',
        'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg focus-visible:ring-offset-2',
        mobileOnly ? 'inline-flex md:hidden' : 'inline-flex',
        variant === 'primary'
          ? 'bg-primary text-white shadow-button hover:bg-primary-hover'
          : 'border border-border bg-white text-slate-600 hover:bg-surface',
      )}
    >
      {children}
    </a>
  )
}

/** Presentational view kept separate from Firestore/API effects for deterministic verification. */
export function LineNotificationSettingsView({
  loading,
  available,
  linked,
  enabled,
  linkCode,
  remainingSeconds,
  generating,
  updating,
  sending,
  unlinking,
  unlinkModalOpen,
  scheduleHours,
  wordsPerNotification,
  addFriendUrl,
  sendCodeUrl,
  onGenerateLinkCode,
  onUpdateEnabled,
  onSendTestNotification,
  onOpenUnlinkModal,
  onCloseUnlinkModal,
  onUnlinkLineAccount,
}: LineNotificationSettingsViewProps) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const copyResetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) window.clearTimeout(copyResetTimerRef.current)
    }
  }, [])

  const copyLinkCode = async () => {
    if (!linkCode) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(linkCode)
      setCopied(true)
      toast.success('Copied')
      if (copyResetTimerRef.current !== null) window.clearTimeout(copyResetTimerRef.current)
      copyResetTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy code')
    }
  }

  const steps = linkCode
    ? [
        {
          label: 'Add the AnkiFlow bot on LINE',
          description: 'Continue below if you still need to add the official account.',
          status: 'completed' as const,
        },
        {
          label: 'Generate a one-time code',
          description: 'Your code is ready.',
          status: 'completed' as const,
        },
        {
          label: 'Send the code to the bot',
          description: 'Send it before the countdown reaches 00:00.',
          status: 'active' as const,
        },
      ]
    : [
        {
          label: 'Add the AnkiFlow bot on LINE',
          description: addFriendUrl
            ? 'Open the official account and add it as a friend.'
            : 'The LINE bot link has not been configured yet.',
          status: 'active' as const,
        },
        {
          label: 'Generate a one-time code',
          description: 'The code stays valid for 10 minutes.',
          status: 'pending' as const,
        },
        {
          label: 'Send the code to the bot',
          description: 'AnkiFlow links automatically after the bot receives it.',
          status: 'pending' as const,
        },
      ]

  const viewState = loading
    ? 'loading'
    : !available
      ? 'disabled'
      : linked
        ? 'linked'
        : linkCode
          ? 'waiting'
          : 'unlinked'

  return (
    <div
      {...verifyAttrs({
        unit: 'LineNotificationSettings',
        state: viewState,
        codeReady: Boolean(linkCode),
      })}
    >
      <SectionHeader icon={Bell} label="LINE Notifications" tone="green" />

      {loading ? (
        <p className="text-sm text-slate-400">Loading LINE notification settings…</p>
      ) : !available ? (
        <div className="p-[14px] border border-[#eceae4] rounded-[11px] bg-surface">
          <p className="text-sm font-semibold text-slate-600">
            LINE reminders are disabled by administrator.
          </p>
        </div>
      ) : !linked ? (
        <div className="flex flex-col gap-4">
          <InfoCallout>
            You&apos;ll get scheduled vocabulary review reminders on LINE after linking your
            account.
          </InfoCallout>

          <StepIndicator steps={steps} />

          <div className="flex items-center gap-2 flex-wrap">
            {addFriendUrl ? (
              <LineActionLink
                href={addFriendUrl}
                variant={linkCode ? 'secondary' : 'primary'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open LINE &amp; add bot
              </LineActionLink>
            ) : (
              <div
                role="note"
                className="w-full p-3 rounded-[10px] border border-[#efe0c6] bg-[#faf3e6]"
              >
                <p className="text-[12.5px] font-bold text-[#8a5810]">
                  LINE bot link is not configured.
                </p>
                <p className="mt-1 text-[12px] text-slate-600">
                  Ask your administrator to configure the AnkiFlow LINE Official Account ID.
                </p>
              </div>
            )}

            {!linkCode && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Link2 className="w-3.5 h-3.5" />}
                loading={generating}
                onClick={() => void onGenerateLinkCode()}
              >
                Generate code
              </Button>
            )}
          </div>

          {linkCode && (
            <div className="p-4 rounded-[11px] border border-primary/20 bg-primary-bg">
              <p className="text-center text-[11px] font-bold uppercase tracking-[0.05em] font-mono text-slate-500">
                Send this code to the bot
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                <p className="text-xl sm:text-2xl font-extrabold font-mono tracking-[0.08em] text-primary break-all">
                  {linkCode}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={
                    copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />
                  }
                  onClick={() => void copyLinkCode()}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="mt-2 text-center text-[12px] text-slate-500">
                Expires in{' '}
                <span className="font-mono font-bold">{formatCountdown(remainingSeconds)}</span>
              </p>

              <div className="mt-3 flex justify-center">
                {sendCodeUrl ? (
                  <LineActionLink href={sendCodeUrl} mobileOnly>
                    <Send className="w-3.5 h-3.5" />
                    Open LINE &amp; send code
                  </LineActionLink>
                ) : (
                  <p className="text-center text-[12px] text-slate-500">
                    Copy the code, open the bot in LINE, then paste and send it.
                  </p>
                )}
              </div>

              <p
                role="status"
                aria-live="polite"
                className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-primary"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Waiting for your message in LINE…
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#f5f5f1]">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-primary-bg text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Linked ✓
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<UnlinkIcon className="w-3.5 h-3.5" />}
              onClick={onOpenUnlinkModal}
            >
              Unlink
            </Button>
          </div>

          <Toggle
            bare
            label="Enable LINE reminders"
            description="Receive scheduled vocabulary review reminders on LINE."
            checked={enabled}
            disabled={updating}
            onChange={(nextEnabled) => void onUpdateEnabled(nextEnabled)}
          />

          {enabled && (
            <div className="p-[14px] rounded-[10px] border border-[#eceae4] bg-[#fcfcfb]">
              <p className="text-[12.5px] text-slate-600">
                {scheduleHours.length === 0
                  ? 'The administrator has not scheduled reminders yet.'
                  : `Reminders arrive at ${scheduleHours
                      .map((hour) => `${String(hour).padStart(2, '0')}:00`)
                      .join(', ')} your local time · ${wordsPerNotification} words each.`}
              </p>
            </div>
          )}

          <div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Send className="w-3.5 h-3.5" />}
              disabled={!enabled}
              loading={sending}
              onClick={() => void onSendTestNotification()}
            >
              Send test now
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={unlinkModalOpen}
        onClose={onCloseUnlinkModal}
        onConfirm={() => void onUnlinkLineAccount()}
        title="Unlink LINE account?"
        description="Scheduled reminders will be disabled until you link an account again."
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCloseUnlinkModal}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={unlinking}
            onClick={() => void onUnlinkLineAccount()}
          >
            Unlink
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export function LineNotificationSettings() {
  const { user, loading: authLoading } = useAuth()
  const { config, loading: globalLoading } = useGlobalConfig()
  const toast = useToast()
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [linked, setLinked] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [sending, setSending] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false)
  const awaitingLinkRef = useRef(false)

  useEffect(() => {
    if (authLoading || !user) return

    return onSnapshot(
      doc(db, 'settings', user.uid),
      (snapshot) => {
        const data = (snapshot.data() ?? {}) as UserLineSettings
        const isLinked = typeof data.line_user_id === 'string' && data.line_user_id.trim().length > 0
        if (isLinked && awaitingLinkRef.current) {
          awaitingLinkRef.current = false
          toast.success('LINE account linked')
        }
        setLinked(isLinked)
        setEnabled(data.line_notifications_enabled === true)
        setSettingsLoading(false)
        if (isLinked) {
          setLinkCode(null)
          setExpiresAt(null)
        }
      },
      (error) => {
        console.error('Failed to watch LINE notification settings:', error)
        setSettingsLoading(false)
      },
    )
  }, [authLoading, toast, user])

  useEffect(() => {
    if (!expiresAt) return

    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setRemainingSeconds(remaining)
      if (remaining === 0) {
        awaitingLinkRef.current = false
        setLinkCode(null)
        setExpiresAt(null)
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [expiresAt])

  const generateLinkCode = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/notifications/line-link', { method: 'POST' })
      const data = await readResponse(response)
      if (!response.ok || !data.code || !data.expires_at) {
        throw new Error(data.error ?? 'Failed to generate link code')
      }

      const remaining = Math.max(0, Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / 1000))
      setLinkCode(data.code)
      setExpiresAt(data.expires_at)
      setRemainingSeconds(remaining)
      awaitingLinkRef.current = true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate link code')
    } finally {
      setGenerating(false)
    }
  }

  const updateEnabled = async (nextEnabled: boolean) => {
    if (!user) return
    setUpdating(true)
    try {
      await setDoc(
        doc(db, 'settings', user.uid),
        {
          line_notifications_enabled: nextEnabled,
          // 管理者の配信時刻を user のローカル時刻として解釈するため、timezone を保存する。
          ...(nextEnabled
            ? { line_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
            : {}),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      )
      toast.success(nextEnabled ? 'LINE reminders enabled' : 'LINE reminders disabled')
    } catch (error) {
      console.error('Failed to update LINE reminders:', error)
      toast.error('Failed to update LINE reminders')
    } finally {
      setUpdating(false)
    }
  }

  const sendTestNotification = async () => {
    setSending(true)
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await readResponse(response)
      if (!response.ok) throw new Error(data.error ?? 'Failed to send test notification')

      toast.success(
        data.sent && data.sent > 0
          ? `Sent ${data.sent} words to LINE`
          : data.message ?? 'No entries are due for review',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send test notification')
    } finally {
      setSending(false)
    }
  }

  const unlinkLineAccount = async () => {
    if (unlinking) return
    setUnlinking(true)
    try {
      const response = await fetch('/api/notifications/line-link', { method: 'DELETE' })
      const data = await readResponse(response)
      if (!response.ok) throw new Error(data.error ?? 'Failed to unlink LINE account')

      awaitingLinkRef.current = false
      setUnlinkModalOpen(false)
      toast.success('LINE account unlinked')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unlink LINE account')
    } finally {
      setUnlinking(false)
    }
  }

  const scheduleHours = config.line_schedule_hours ?? []
  const wordsPerNotification = config.line_words_per_notification ?? 5
  const addFriendUrl = buildLineAddFriendUrl(LINE_ADD_FRIEND_URL, LINE_BOT_ID)
  const sendCodeUrl = linkCode ? buildLineSendCodeUrl(LINE_BOT_ID, linkCode) : null

  return (
    <LineNotificationSettingsView
      loading={globalLoading || settingsLoading}
      available={config.line_notifications_available !== false}
      linked={linked}
      enabled={enabled}
      linkCode={linkCode}
      remainingSeconds={remainingSeconds}
      generating={generating}
      updating={updating}
      sending={sending}
      unlinking={unlinking}
      unlinkModalOpen={unlinkModalOpen}
      scheduleHours={scheduleHours}
      wordsPerNotification={wordsPerNotification}
      addFriendUrl={addFriendUrl}
      sendCodeUrl={sendCodeUrl}
      onGenerateLinkCode={generateLinkCode}
      onUpdateEnabled={updateEnabled}
      onSendTestNotification={sendTestNotification}
      onOpenUnlinkModal={() => setUnlinkModalOpen(true)}
      onCloseUnlinkModal={() => setUnlinkModalOpen(false)}
      onUnlinkLineAccount={unlinkLineAccount}
    />
  )
}
