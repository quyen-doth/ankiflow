'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { AiOutputProfilesEditor } from '@/components/admin/AiOutputProfilesEditor'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/components/providers/AuthProvider'
import { cn } from '@/lib/utils'
import { resolveContentTypeFormType, validateContentTypeConfig } from '@/lib/contentTypes'
import {
  getContentTypePrimaryFieldKey,
  validateContentTypeBlueprint,
} from '@/lib/create/formBlueprint'
import {
  cloneStoredContentTypeAiProfiles,
  materializeContentTypeAiProfiles,
} from '@/lib/ai-agent/contentTypeProfiles'
import {
  AI_OUTPUT_FIELD_KEY_PATTERN,
  parseAiOutputProfiles,
} from '@/lib/ai-agent/outputProfiles'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import { FormType } from '@/types'
import type { AiOutputProfile, ContentType, FormFieldConfig } from '@/types'

const FIELD_TYPE_OPTIONS: { value: FormFieldConfig['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox_group', label: 'Checkbox group' },
  { value: 'tags', label: 'Tags' },
  { value: 'number', label: 'Number' },
]

interface ContentTypeDraft {
  code: string
  name: string
  description: string
  icon: string
  is_active: boolean
  sort_order: number
  default_create_mode: 'single' | 'batch'
}

const EMPTY_DRAFT: ContentTypeDraft = {
  code: '',
  name: '',
  description: '',
  icon: 'BookOpen',
  is_active: true,
  sort_order: 0,
  default_create_mode: 'single',
}

const EMPTY_FIELD: FormFieldConfig = {
  field_key: '',
  label: '',
  type: 'text',
  is_required: false,
  is_session_persistent: false,
  sort_order: 0,
  placeholder: null,
  data_source: null,
  options: [],
}

export type ContentTypeEditorScope = 'workspace' | 'global-defaults'

function draftFromContentType(contentType: ContentType | null): ContentTypeDraft {
  if (!contentType) return EMPTY_DRAFT
  return {
    code: contentType.code,
    name: contentType.name,
    description: contentType.description,
    icon: contentType.icon,
    is_active: contentType.is_active,
    sort_order: contentType.sort_order,
    default_create_mode: contentType.default_create_mode ?? 'single',
  }
}

function fieldsFromContentType(contentType: ContentType | null): FormFieldConfig[] {
  if (!contentType) return []
  return [...contentType.fields]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map(field => ({ ...field }))
}

function profilesFromContentType(contentType: ContentType | null): AiOutputProfile[] {
  if (!contentType) return []
  try {
    return materializeContentTypeAiProfiles(contentType).profiles
  } catch {
    // Stored profile が parse できない場合も編集を継続できるようにする。
    // clone 側で normalize されるため、Default 追加 field が誤って exclude されない。
    return cloneStoredContentTypeAiProfiles(contentType)
  }
}

interface ContentTypeEditorProps {
  /** null → 新規作成。 */
  contentType: ContentType | null
  scope: ContentTypeEditorScope
  /** 新規作成時の code 重複チェック用。 */
  existingCodes?: readonly string[]
  onSaved: () => void
  onCancel: () => void
  /** `page` は sticky action bar、`modal` は従来どおり末尾の button 行。 */
  layout?: 'modal' | 'page'
  /** 未保存ガード用。保存直後は false を通知して離脱を妨げない。 */
  onDirtyChange?: (dirty: boolean) => void
}

export function ContentTypeEditor({
  contentType,
  scope,
  existingCodes = [],
  onSaved,
  onCancel,
  layout = 'modal',
  onDirtyChange,
}: ContentTypeEditorProps) {
  const { user } = useAuth()
  const uid = user?.uid
  const isAdmin = !!user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isGlobalScope = scope === 'global-defaults' && isAdmin
  const collectionName = isGlobalScope
    ? GLOBAL_CONTENT_TYPES_COLLECTION
    : USER_CONTENT_TYPES_COLLECTION

  const editing = contentType
  const [draft, setDraft] = useState<ContentTypeDraft>(() => draftFromContentType(contentType))
  const [fields, setFields] = useState<FormFieldConfig[]>(() => fieldsFromContentType(contentType))
  const [aiOutputProfiles, setAiOutputProfiles] = useState<AiOutputProfile[]>(
    () => profilesFromContentType(contentType),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const toast = useToast()

  const [initialSnapshot] = useState(() => JSON.stringify({
    draft: draftFromContentType(contentType),
    fields: fieldsFromContentType(contentType),
    profiles: profilesFromContentType(contentType),
  }))
  const dirty = !saved
    && JSON.stringify({ draft, fields, profiles: aiOutputProfiles }) !== initialSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const aiProfileContext = useMemo(() => {
    const code = draft.code.trim()
    if (resolveContentTypeFormType(code) === FormType.GENERAL) {
      return { primaryFieldKey: 'title', disabledReason: 'General Knowledge uses local form content and does not call the AI generator.' }
    }
    try {
      return {
        primaryFieldKey: getContentTypePrimaryFieldKey({ code, name: draft.name, fields }),
        disabledReason: undefined,
      }
    } catch {
      return { primaryFieldKey: null, disabledReason: undefined }
    }
  }, [draft.code, draft.name, fields])

  const initializeAiOutputProfiles = () => {
    try {
      const materialized = materializeContentTypeAiProfiles({
        code: draft.code.trim(),
        name: draft.name.trim(),
        fields,
      })
      setAiOutputProfiles(materialized.profiles)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Add a valid primary form field first.')
    }
  }

  const updateField = <K extends keyof FormFieldConfig>(index: number, key: K, value: FormFieldConfig[K]) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f))
  }

  const addField = () => {
    setFields(prev => [...prev, { ...EMPTY_FIELD, sort_order: prev.length }])
  }

  const removeField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!uid) return
    const validation = validateContentTypeConfig({
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      fields,
    }, editing?.code)
    if (!validation.success) {
      toast.error(validation.issues[0]?.message ?? 'Invalid content type configuration.')
      return
    }

    const blueprintValidation = validateContentTypeBlueprint(validation.data)
    if (!blueprintValidation.success) {
      toast.error(blueprintValidation.error)
      return
    }

    const primaryFieldKey = getContentTypePrimaryFieldKey(validation.data)
    const usesAiGeneration = resolveContentTypeFormType(validation.data.code) !== FormType.GENERAL

    // `field_key` の form validation は snake_case を強制しないが、AI output key は強制する。
    // ここで弾かないと materialize が Zod error を投げ、Save が無反応になる。
    if (usesAiGeneration && !AI_OUTPUT_FIELD_KEY_PATTERN.test(primaryFieldKey)) {
      toast.error(`Primary field key "${primaryFieldKey}" must be lowercase snake_case to be used as an AI output field.`)
      return
    }

    let profilesToPersist = aiOutputProfiles
    // materialize も parse も throw しうる — 片方だけ守ると Save が黙って死ぬ。
    try {
      if (usesAiGeneration && profilesToPersist.length === 0) {
        profilesToPersist = materializeContentTypeAiProfiles(validation.data).profiles
      }
      if (profilesToPersist.length > 0) {
        profilesToPersist = parseAiOutputProfiles(profilesToPersist, primaryFieldKey)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid AI output profiles.')
      return
    }
    const completeData = {
      ...validation.data,
      ...(profilesToPersist.length > 0 ? { ai_output_profiles: profilesToPersist } : {}),
    }

    if (!editing) {
      const normalizedCode = validation.data.code.toLocaleLowerCase('en-US')
      const duplicate = existingCodes.some(code =>
        code.trim().toLocaleLowerCase('en-US') === normalizedCode)
      if (duplicate) {
        toast.error('Content type code must be unique in this workspace.')
        return
      }
    }

    setSaving(true)
    try {
      if (editing) {
        const { code: _immutableCode, ...editableData } = completeData
        void _immutableCode
        await updateDoc(doc(db, collectionName, editing.id), {
          ...editableData,
          updated_at: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, collectionName), {
          ...completeData,
          ...(isGlobalScope ? {} : { user_id: uid }),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setSaved(true)
      onSaved()
      toast.success(editing ? 'Content type updated' : 'Content type created')
    } catch (error) {
      console.error('Error saving content type:', error)
      toast.error('Failed to save content type.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = !saving && !!draft.name.trim() && !!draft.code.trim()

  const metadataSection = (
    <>
      {/* Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldWrapper label="Name">
          <Input
            aria-label="Content type name"
            value={draft.name}
            onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Medical Terms"
          />
        </FieldWrapper>
        <FieldWrapper label="Code">
          <Input
            aria-label="Content type code"
            value={draft.code}
            onChange={(e) => setDraft(d => ({ ...d, code: e.target.value }))}
            placeholder="e.g. form_medical"
            disabled={!!editing}
          />
        </FieldWrapper>
      </div>
      <FieldWrapper label="Description">
        <Input
          aria-label="Description"
          value={draft.description}
          onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
          placeholder="Short description of this content type"
        />
      </FieldWrapper>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldWrapper label="Icon">
          <Input
            aria-label="Icon name"
            value={draft.icon}
            onChange={(e) => setDraft(d => ({ ...d, icon: e.target.value }))}
            placeholder="e.g. BookOpen"
          />
        </FieldWrapper>
        <FieldWrapper label="Sort Order">
          <Input
            type="number"
            aria-label="Sort Order"
            value={draft.sort_order}
            onChange={(e) => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))}
          />
        </FieldWrapper>
      </div>

      <Toggle
        label="Active"
        description="Visible and selectable in the Create flow"
        checked={draft.is_active}
        onChange={(v) => setDraft(d => ({ ...d, is_active: v }))}
      />

      <FieldWrapper label="Default create mode">
        <div className="inline-flex gap-1 bg-[#ececea] rounded-[11px] p-1" role="radiogroup" aria-label="Default create mode">
          {(['single', 'batch'] as const).map((mode) => {
            const active = draft.default_create_mode === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDraft(d => ({ ...d, default_create_mode: mode }))}
                className={cn(
                  'px-4 py-[7px] rounded-[8px] text-[13px] font-bold capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  active ? 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'bg-transparent text-[#7c7f87] hover:text-ink',
                )}
              >
                {mode}
              </button>
            )
          })}
        </div>
        <p className="text-[12px] text-slate-400 mt-1.5">Pre-selected when this content type is opened in Create (user can still switch).</p>
      </FieldWrapper>
    </>
  )

  const fieldsSection = (
    <>
      {/* Fields */}
      <div className="flex items-center justify-between mt-2">
        <h3 className="text-body font-semibold text-slate-600">Fields</h3>
        <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addField}>
          Add Field
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={index} className="rounded-card border border-border/40 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-overline text-slate-600">
              {field.field_key || `field_${index}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeField(index)}
              className="p-1.5 h-auto text-slate-600 hover:text-danger rounded-full"
              aria-label={`Remove field ${field.field_key || index}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <FieldWrapper label="Field Key">
              <Input
                aria-label={`Field key ${index}`}
                value={field.field_key}
                onChange={(e) => updateField(index, 'field_key', e.target.value)}
                placeholder="e.g. definition"
              />
            </FieldWrapper>
            <FieldWrapper label="Label">
              <Input
                aria-label={`Label for field ${index}`}
                value={field.label}
                onChange={(e) => updateField(index, 'label', e.target.value)}
                placeholder="e.g. Definition"
              />
            </FieldWrapper>
            <FieldWrapper label="Type">
              <Select
                aria-label={`Type for field ${index}`}
                value={field.type}
                onChange={(e) => updateField(index, 'type', e.target.value as FormFieldConfig['type'])}
              >
                {FIELD_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FieldWrapper>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldWrapper label="Placeholder">
              <Input
                value={field.placeholder || ''}
                onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                placeholder="Optional placeholder"
              />
            </FieldWrapper>
            <FieldWrapper label="Sort Order">
              <Input
                type="number"
                aria-label={`Sort order for field ${index}`}
                value={field.sort_order}
                onChange={(e) => updateField(index, 'sort_order', Number(e.target.value))}
              />
            </FieldWrapper>
          </div>
          {field.type === 'dropdown' && (
            <FieldWrapper label="Options">
              <Input
                aria-label={`Options for field ${index}`}
                value={(field.options ?? []).join(', ')}
                onChange={(e) => updateField(
                  index,
                  'options',
                  e.target.value.split(',').map(option => option.trim()).filter(Boolean),
                )}
                placeholder="Beginner, Intermediate, Advanced"
              />
            </FieldWrapper>
          )}
          <div className="flex flex-col gap-2">
            <Toggle
              label="Required"
              description="The user must fill in this field before submitting"
              checked={field.is_required}
              onChange={(v) => updateField(index, 'is_required', v)}
            />
            <Toggle
              label="Persist across entries"
              description="Keep the value saved in the session for the next entry"
              checked={field.is_session_persistent}
              onChange={(v) => updateField(index, 'is_session_persistent', v)}
            />
          </div>
        </div>
      ))}

      {fields.length === 0 && (
        <p className="text-sm text-slate-600 text-center py-4">
          No fields yet. Click &quot;Add Field&quot; to define form fields.
        </p>
      )}
    </>
  )

  const aiSection = (
    <AiOutputProfilesEditor
        profiles={aiOutputProfiles}
        primaryFieldKey={aiProfileContext.primaryFieldKey}
        disabledReason={aiProfileContext.disabledReason}
        contentType={{
          code: draft.code,
          name: draft.name,
          description: draft.description,
          fields,
        }}
      onInitialize={initializeAiOutputProfiles}
      onChange={setAiOutputProfiles}
    />
  )

  const actions = (
    <>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={handleSave} disabled={!canSave}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </>
  )

  if (layout === 'page') {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {metadataSection}
            {fieldsSection}
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            {aiSection}
          </div>
        </div>
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-2 flex items-center justify-end gap-3 border-t border-border bg-surface/95 px-4 sm:px-6 py-3 backdrop-blur">
          {actions}
        </div>
      </div>
    )
  }

  return (
    <>
      {metadataSection}
      {fieldsSection}
      {aiSection}
      <div className="flex gap-3 justify-end mt-2">
        {actions}
      </div>
    </>
  )
}
