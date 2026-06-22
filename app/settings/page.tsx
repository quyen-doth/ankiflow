'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Toggle'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MonitorCheck, MonitorX, Sparkles, Volume2, ImageIcon, Settings as SettingsIcon, SlidersHorizontal, Check } from 'lucide-react'
import type { Settings } from '@/types'

const SETTINGS_DOC_ID = 'default'

const CLAUDE_MODEL_OPTIONS = [
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
]

interface IntegrationStatus {
  label: string
  description: string
  icon: React.ReactNode
  connected: boolean
  checking: boolean
}

function IntegrationCard({ label, description, icon, connected, checking }: IntegrationStatus) {
  return (
    <div className="flex items-center gap-4 p-4 bg-surface rounded-lg">
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 text-slate-600">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-overline text-slate-600 truncate">{description}</p>
      </div>
      {checking ? (
        <Badge variant="neutral">Checking...</Badge>
      ) : (
        <Badge className={connected ? 'bg-primary-bg text-primary' : 'bg-danger-bg text-danger'}>
          <span className={`inline-block w-[6px] h-[6px] rounded-full mr-1.5 ${connected ? 'bg-primary' : 'bg-danger'}`} />
          {connected ? 'Connected' : 'Offline'}
        </Badge>
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
    } catch (error) {
      console.error('Error saving settings:', error)
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
          <div className="flex items-center gap-2.5 mb-4">
            <SettingsIcon className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono font-bold">Integrations</h2>
          </div>
          <div className="flex flex-col gap-3">
            <IntegrationCard
              label="Anki Desktop"
              description="Local AnkiConnect plugin at localhost:8765"
              icon={<MonitorCheck className="w-5 h-5" />}
              connected={ankiConnected}
              checking={checkingAnki}
            />
            <IntegrationCard
              label="Claude API"
              description={`Model: ${settings.ai_model ?? 'claude-haiku-4-5'}`}
              icon={<Sparkles className="w-5 h-5" />}
              connected
              checking={false}
            />
            <IntegrationCard
              label="Google Cloud TTS"
              description={settings.tts_enabled ? 'Audio generation enabled' : 'Audio generation disabled'}
              icon={<Volume2 className="w-5 h-5" />}
              connected={settings.tts_enabled}
              checking={false}
            />
            <IntegrationCard
              label="Unsplash"
              description={settings.unsplash_enabled ? 'Image search enabled' : 'Image search disabled'}
              icon={<ImageIcon className="w-5 h-5" />}
              connected={settings.unsplash_enabled}
              checking={false}
            />
          </div>
        </Card>

        {/* AI config */}
        <Card>
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono font-bold">AI generation</h2>
          </div>
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
          <div className="mt-3">
            <Toggle
              label="Enable web search"
              description="Cho phép AI agent tra cứu web để kiểm chứng nghĩa/cách dùng (chậm và tốn phí hơn)"
              checked={settings.web_search_enabled ?? false}
              onChange={(v) => updateField('web_search_enabled', v)}
            />
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <div className="flex items-center gap-2.5 mb-4">
            <SlidersHorizontal className="w-[18px] h-[18px] text-primary" />
            <h2 className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono font-bold">Preferences</h2>
          </div>
          <div className="flex flex-col gap-3">
            <Toggle
              label="Enable Unsplash images"
              description="Search for illustration images when generating cards"
              checked={settings.unsplash_enabled}
              onChange={(v) => updateField('unsplash_enabled', v)}
            />
            <Toggle
              label="Enable text-to-speech"
              description="Generate native audio pronunciation for vocabulary"
              checked={settings.tts_enabled}
              onChange={(v) => updateField('tts_enabled', v)}
            />
            <Toggle
              label="Auto-generate audio"
              description="Automatically request audio when a card is generated"
              checked={settings.auto_audio}
              onChange={(v) => updateField('auto_audio', v)}
            />
            <Toggle
              label="Auto-fetch images"
              description="Automatically search for illustration images when a card is generated"
              checked={settings.auto_image}
              onChange={(v) => updateField('auto_image', v)}
            />
            <Toggle
              label="Allow duplicate entries"
              description="Permit creating cards for vocabulary that already exists"
              checked={settings.allow_duplicate}
              onChange={(v) => updateField('allow_duplicate', v)}
            />
          </div>
        </Card>

        {savedAt && (
          <p className="text-overline text-slate-600 text-center">Saved successfully.</p>
        )}
      </div>
    </>
  )
}
