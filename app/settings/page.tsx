'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Toggle'
import { FieldWrapper, Select } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Monitor, Sparkles, Volume2, ImageIcon, SlidersHorizontal, Plug, Brain, Check, Bell, RefreshCw, MessageSquare } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import type { Settings } from '@/types'

const SETTINGS_DOC_ID = 'default'

const CLAUDE_MODEL_OPTIONS = [
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
]

type Tone = 'green' | 'amber'

const HEADER_TONE: Record<Tone, string> = {
  green: 'text-primary bg-[rgba(49,99,66,0.1)]',
  amber: 'text-[#b87514] bg-[rgba(184,117,20,0.1)]',
}

const ICON_TONE: Record<Tone, string> = {
  green: 'text-primary bg-[rgba(49,99,66,0.08)]',
  amber: 'text-[#b87514] bg-[rgba(184,117,20,0.08)]',
}

function SectionHeader({ icon: Icon, label, tone }: { icon: React.ElementType; label: string; tone: Tone }) {
  return (
    <div className="flex items-center gap-2 mb-[18px]">
      <span className={cn('w-[26px] h-[26px] rounded-[7px] flex items-center justify-center flex-shrink-0', HEADER_TONE[tone])}>
        <Icon className="w-[15px] h-[15px]" />
      </span>
      <span className="text-[12px] font-bold tracking-[0.05em] uppercase font-mono text-slate-600">{label}</span>
    </div>
  )
}

interface IntegrationCardProps {
  label: string
  description: string
  icon: React.ElementType
  tone: Tone
  descMono?: boolean
  connected: boolean
  checking: boolean
}

function IntegrationCard({ label, description, icon: Icon, tone, descMono, connected, checking }: IntegrationCardProps) {
  return (
    <div className="flex items-center gap-3.5 p-[14px] border border-[#eceae4] rounded-[11px]">
      <span className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0', ICON_TONE[tone])}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-ink">{label}</p>
        <p className={cn('text-[12.5px] text-slate-400 truncate', descMono && 'font-mono')}>{description}</p>
      </div>
      {checking ? (
        <span className="inline-flex items-center text-[12px] font-bold text-slate-400 bg-canvas px-3 py-1.5 rounded-full">
          Checking…
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full',
            connected ? 'bg-[rgba(49,99,66,0.08)] text-primary' : 'bg-danger-bg text-danger'
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-primary' : 'bg-danger')} />
          {connected ? 'Connected' : 'Offline'}
        </span>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [ankiConnected, setAnkiConnected] = useState(false)
  const [checkingAnki, setCheckingAnki] = useState(true)
  const [syncingSRS, setSyncingSRS] = useState(false)
  const toast = useToast()

  useEffect(() => {
    async function fetchSettings() {
      try {
        const ref = doc(db, 'settings', SETTINGS_DOC_ID)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          setSettings(snap.data() as Settings)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  useEffect(() => {
    async function checkAnki() {
      try {
        const res = await fetch('/api/anki/connect', { cache: 'no-store' })
        setAnkiConnected(res.ok)
      } catch {
        setAnkiConnected(false)
      } finally {
        setCheckingAnki(false)
      }
    }
    checkAnki()
  }, [])

  const updateField = useCallback(<K extends keyof Settings>(field: K, value: Settings[K]) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const ref = doc(db, 'settings', SETTINGS_DOC_ID)
      await setDoc(ref, { ...settings, updated_at: serverTimestamp() }, { merge: true })
      setSavedAt(Date.now())
      toast.success('Settings saved')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <p className="text-lg font-semibold text-ink mb-2">Settings not found</p>
          <p className="text-sm text-slate-600">
            Run <code className="px-1.5 py-0.5 rounded-md bg-surface text-ink">npm run seed</code> to initialize the settings document.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage integrations and global preferences."
        actions={
          <Button variant="primary" leftIcon={<Check className="w-4 h-4" />} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />

      <div className="max-w-3xl mx-auto w-full pb-12 flex flex-col gap-8">

        {/* Integrations */}
        <Card>
          <SectionHeader icon={Plug} label="Integrations" tone="green" />
          <div className="flex flex-col gap-2.5">
            <IntegrationCard
              label="Anki Desktop"
              description="Local AnkiConnect plugin at localhost:8765"
              icon={Monitor}
              tone="green"
              connected={ankiConnected}
              checking={checkingAnki}
            />
            <IntegrationCard
              label="Claude API"
              description={settings.ai_model ?? 'claude-haiku-4-5'}
              icon={Sparkles}
              tone="amber"
              descMono
              connected
              checking={false}
            />
            <IntegrationCard
              label="Google Cloud TTS"
              description={settings.tts_enabled ? 'Audio generation enabled' : 'Audio generation disabled'}
              icon={Volume2}
              tone="green"
              connected={settings.tts_enabled}
              checking={false}
            />
            <IntegrationCard
              label="Unsplash"
              description={settings.unsplash_enabled ? 'Image search enabled' : 'Image search disabled'}
              icon={ImageIcon}
              tone="green"
              connected={settings.unsplash_enabled}
              checking={false}
            />
          </div>
        </Card>

        {/* AI config */}
        <Card>
          <SectionHeader icon={Brain} label="AI generation" tone="amber" />
          <FieldWrapper label="Claude Model">
            <Select
              value={settings.ai_model ?? 'claude-haiku-4-5'}
              onChange={(e) => updateField('ai_model', e.target.value)}
            >
              {CLAUDE_MODEL_OPTIONS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </FieldWrapper>
          <div className="mt-3.5 flex items-center p-[14px] border border-[#eceae4] rounded-[11px] bg-[#fcfcfb]">
            <Toggle
              bare
              label="Enable web search"
              description="Allow AI agent to search the web for verification (slower and more expensive)"
              checked={settings.web_search_enabled ?? false}
              onChange={(v) => updateField('web_search_enabled', v)}
            />
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <SectionHeader icon={SlidersHorizontal} label="Preferences" tone="green" />
          <div className="flex flex-col">
            {([
              { key: 'unsplash_enabled', label: 'Enable Unsplash images', description: 'Search for illustration images when generating cards.' },
              { key: 'tts_enabled', label: 'Enable text-to-speech', description: 'Generate native audio pronunciation for vocabulary.' },
              { key: 'auto_audio', label: 'Auto-generate audio', description: 'Automatically request audio when a card is generated.' },
              { key: 'auto_image', label: 'Auto-fetch images', description: 'Automatically search for illustration images when a card is generated.' },
              { key: 'allow_duplicate', label: 'Allow duplicate entries', description: 'Permit creating cards for vocabulary that already exists.' },
            ] as const).map(pref => (
              <div key={pref.key} className="py-[15px] border-b border-[#f5f5f1] last:border-b-0">
                <Toggle
                  bare
                  label={pref.label}
                  description={pref.description}
                  checked={settings[pref.key]}
                  onChange={(v) => updateField(pref.key, v)}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <SectionHeader icon={Bell} label="Notifications" tone="amber" />
          <div className="flex flex-col gap-3.5">
            <div className="py-[15px] border-b border-[#f5f5f1]">
              <Toggle
                bare
                label="Enable notifications"
                description="Send vocabulary review reminders via LINE."
                checked={settings.notifications_enabled ?? false}
                onChange={(v) => updateField('notifications_enabled', v)}
              />
            </div>

            <IntegrationCard
              label="LINE Messaging"
              description={settings.line_channel_access_token ? 'Token configured' : 'Not configured'}
              icon={MessageSquare}
              tone="amber"
              connected={!!settings.line_channel_access_token}
              checking={false}
            />

            <FieldWrapper label="LINE Channel Access Token">
              <input
                type="password"
                value={settings.line_channel_access_token ?? ''}
                onChange={(e) => updateField('line_channel_access_token', e.target.value || undefined)}
                placeholder="Paste your LINE Channel Access Token"
                className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] px-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow font-mono"
              />
            </FieldWrapper>

            <FieldWrapper label="LINE User ID">
              <input
                type="text"
                value={settings.line_user_id ?? ''}
                onChange={(e) => updateField('line_user_id', e.target.value || undefined)}
                placeholder="Your LINE User ID"
                className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] px-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow font-mono"
              />
            </FieldWrapper>
          </div>
        </Card>

        {/* SRS Sync */}
        <Card>
          <SectionHeader icon={RefreshCw} label="SRS Data Sync" tone="green" />
          <p className="text-sm text-slate-600 mb-4">
            Sync spaced repetition data from Anki Desktop to Firestore. Requires Anki Desktop to be open.
          </p>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<RefreshCw className={cn('w-4 h-4', syncingSRS && 'animate-spin')} />}
            disabled={syncingSRS || !ankiConnected}
            onClick={async () => {
              setSyncingSRS(true)
              try {
                const res = await fetch('/api/anki/sync-srs', { method: 'POST' })
                const data = await res.json()
                if (data.success) {
                  toast.success(`Synced ${data.synced} of ${data.total} entries`)
                } else {
                  toast.error(data.error ?? 'Sync failed')
                }
              } catch {
                toast.error('Failed to sync SRS data.')
              } finally {
                setSyncingSRS(false)
              }
            }}
          >
            {syncingSRS ? 'Syncing...' : 'Sync SRS from Anki'}
          </Button>
          {!ankiConnected && (
            <p className="text-xs text-slate-400 mt-2">Anki Desktop must be running to sync.</p>
          )}
        </Card>

        {savedAt && (
          <p className="text-overline text-slate-600 text-center">Saved successfully.</p>
        )}
      </div>
    </>
  )
}
