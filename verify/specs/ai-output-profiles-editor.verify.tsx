import { useState } from 'react'
import { z } from 'zod'
import { AiOutputProfilesEditor } from '@/components/admin/AiOutputProfilesEditor'
import { Button } from '@/components/ui/Button'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import { cloneAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { AiOutputProfile } from '@/types'

function initialProfiles(): AiOutputProfile[] {
  const profiles = resolveBuiltinAiOutputProfiles(FormType.LANGUAGE)
  if (!profiles) throw new Error('Language profiles are required')
  return profiles
}

function EditorHarness() {
  const [draft, setDraft] = useState<AiOutputProfile[]>(initialProfiles)
  const [saved, setSaved] = useState<AiOutputProfile[]>(initialProfiles)
  const [editing, setEditing] = useState(true)

  const save = () => {
    setSaved(cloneAiOutputProfiles(draft))
    setEditing(false)
  }
  const reopen = () => {
    setDraft(cloneAiOutputProfiles(saved))
    setEditing(true)
  }

  return (
    <div {...verifyAttrs({ unit: 'AiOutputProfilesEditor', editing, profiles: draft.length })}>
      {editing ? (
        <div className="flex flex-col gap-4">
          <AiOutputProfilesEditor
            profiles={draft}
            primaryFieldKey="word"
            onInitialize={() => setDraft(initialProfiles())}
            onChange={setDraft}
          />
          <Button onClick={save} className="self-end">Save Profile Draft</Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p>Profile draft saved.</p>
          <Button onClick={reopen}>Reopen editor</Button>
        </div>
      )}
    </div>
  )
}

registerUnit({
  id: 'AiOutputProfilesEditor',
  title: 'AI Output Profiles Editor',
  description: 'Profile switching, locked primary output, add/remove/reorder and draft persistence.',
  kind: 'component',
  render: () => <EditorHarness />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'default-language-profiles',
      description: 'Language editor starts with Default/English/Chinese/Japanese profiles.',
      props: {},
    },
    {
      id: 'e2e-editor-flow',
      description: 'E2E: edit, add, reorder, remove, save and reopen profile fields.',
      props: {},
    },
    {
      id: 'probe-primary-lock',
      probe: true,
      description: 'Probe: primary word key remains disabled and has no remove action.',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'self-identifies',
      description: 'Editor exposes its verification contract.',
      check: ({ contract }) => contract.unit === 'AiOutputProfilesEditor'
        || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'language-profiles-visible',
      description: 'All built-in Language profile options are available.',
      check: ({ root }) => {
        const options = Array.from(root.querySelectorAll('select[aria-label="AI output profile"] option'))
          .map(option => option.textContent)
        return options.join(',') === 'Default,English,Chinese,Japanese'
          || `options=${options.join(',')}`
      },
    },
    {
      id: 'primary-is-locked',
      description: 'Primary output cannot be renamed or removed.',
      onlyFixtures: ['probe-primary-lock'],
      check: ({ root }) => {
        const input = root.querySelector<HTMLInputElement>('input[aria-label="AI output key 0"]')
        if (!input?.disabled) return 'primary key input is editable'
        return !root.querySelector('button[aria-label="Remove AI output word"]')
          || 'primary output has remove action'
      },
    },
  ],
})
