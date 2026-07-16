'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { Bell, ExternalLink, Link2, Send, Unlink as UnlinkIcon } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useGlobalConfig } from '@/components/providers/GlobalConfigProvider'
import { SectionHeader } from '@/components/settings/SettingsPrimitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { db } from '@/lib/firebase'

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

async function readResponse(response: Response): Promise<LineApiResponse> {
  return response.json().catch(() => ({})) as Promise<LineApiResponse>
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
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

  useEffect(() => {
    if (authLoading || !user) return

    return onSnapshot(
      doc(db, 'settings', user.uid),
      (snapshot) => {
        const data = (snapshot.data() ?? {}) as UserLineSettings
        const isLinked = typeof data.line_user_id === 'string' && data.line_user_id.trim().length > 0
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
  }, [authLoading, user])

  useEffect(() => {
    if (!expiresAt) return

    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setRemainingSeconds(remaining)
      if (remaining === 0) {
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

  return (
    <div>
      <SectionHeader icon={Bell} label="LINE Notifications" tone="green" />

      {globalLoading || settingsLoading ? (
        <p className="text-sm text-slate-400">Loading LINE notification settings…</p>
      ) : config.line_notifications_available === false ? (
        <div className="p-[14px] border border-[#eceae4] rounded-[11px] bg-surface">
          <p className="text-sm font-semibold text-slate-600">
            LINE reminders are disabled by administrator.
          </p>
        </div>
      ) : !linked ? (
        <div className="flex flex-col gap-4">
          <div className="text-sm text-slate-600 leading-relaxed">
            <p>1. Add the AnkiFlow bot as a friend on LINE.</p>
            <p>2. Generate a code and send it to the bot.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {LINE_ADD_FRIEND_URL && (
              <a
                href={LINE_ADD_FRIEND_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[9px] border border-border bg-white text-[12px] font-bold text-slate-600 hover:bg-surface transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Add bot on LINE
              </a>
            )}
            {!linkCode && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Link2 className="w-3.5 h-3.5" />}
                loading={generating}
                onClick={generateLinkCode}
              >
                Generate link code
              </Button>
            )}
          </div>

          {linkCode && (
            <div
              aria-live="polite"
              className="p-4 rounded-[11px] border border-primary/20 bg-primary-bg text-center"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.05em] font-mono text-slate-500">
                Send this code to the bot
              </p>
              <p className="mt-1 text-2xl font-extrabold font-mono tracking-[0.08em] text-primary">
                {linkCode}
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                Expires in <span className="font-mono font-bold">{formatCountdown(remainingSeconds)}</span>
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
              onClick={() => setUnlinkModalOpen(true)}
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
            onChange={updateEnabled}
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
              onClick={sendTestNotification}
            >
              Send test now
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={unlinkModalOpen}
        onClose={() => setUnlinkModalOpen(false)}
        onConfirm={() => void unlinkLineAccount()}
        title="Unlink LINE account?"
        description="Scheduled reminders will be disabled until you link an account again."
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setUnlinkModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={unlinking} onClick={unlinkLineAccount}>
            Unlink
          </Button>
        </div>
      </Modal>
    </div>
  )
}
