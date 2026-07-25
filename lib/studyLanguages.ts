import type { LanguageCode, StudyLanguage } from '@/types'

/** Legacy-compatible defaults used only when a user has no saved language list yet. */
export const DEFAULT_STUDY_LANGUAGES: readonly StudyLanguage[] = [
  { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
  { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
  { code: 'zh', display_name: 'Chinese', enabled: true, sort_order: 2 },
]

function cloneDefaults(): StudyLanguage[] {
  return DEFAULT_STUDY_LANGUAGES.map(language => ({ ...language }))
}

/** Return the canonical BCP 47 tag, or null when the value is not a valid tag. */
export function canonicalizeLanguageCode(value: string): LanguageCode | null {
  const candidate = value.trim().replace(/_/g, '-')
  if (!candidate) return null
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? null
  } catch {
    return null
  }
}

/** English display name for UI fallback; custom names always take precedence elsewhere. */
export function inferLanguageDisplayName(code: string): string {
  const canonical = canonicalizeLanguageCode(code)
  if (!canonical) return code.trim()
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(canonical) ?? canonical
  } catch {
    return canonical
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Tolerant Firestore reader. Invalid rows are skipped, codes are canonicalized,
 * duplicates are collapsed, and missing/corrupt documents use legacy defaults.
 */
export function normalizeStudyLanguages(value: unknown): StudyLanguage[] {
  if (!Array.isArray(value)) return cloneDefaults()

  const seen = new Set<string>()
  const normalized: Array<StudyLanguage & { source_index: number }> = []

  value.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.code !== 'string') return
    const code = canonicalizeLanguageCode(raw.code)
    if (!code) return
    const key = code.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)

    const displayName = typeof raw.display_name === 'string' && raw.display_name.trim()
      ? raw.display_name.trim()
      : inferLanguageDisplayName(code)

    normalized.push({
      code,
      display_name: displayName,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      sort_order: typeof raw.sort_order === 'number' && Number.isFinite(raw.sort_order)
        ? raw.sort_order
        : index,
      source_index: index,
    })
  })

  if (normalized.length === 0) return cloneDefaults()

  normalized.sort((a, b) => a.sort_order - b.sort_order || a.source_index - b.source_index)
  const result = normalized.map((language, index) => ({
    code: language.code,
    display_name: language.display_name,
    enabled: language.enabled,
    sort_order: index,
  }))

  // A corrupt all-disabled document must not make the create flow unusable.
  if (!result.some(language => language.enabled)) result[0].enabled = true
  return result
}

/** Strict validation for user-authored settings before writing to Firestore. */
export function validateStudyLanguages(languages: StudyLanguage[]): string[] {
  const errors: string[] = []
  if (languages.length === 0) return ['Add at least one study language.']

  const seen = new Set<string>()
  for (const language of languages) {
    const code = canonicalizeLanguageCode(language.code)
    if (!code) {
      errors.push(`"${language.code}" is not a valid BCP 47 language code.`)
      continue
    }
    const key = code.toLowerCase()
    if (seen.has(key)) errors.push(`Language code "${code}" is duplicated.`)
    seen.add(key)
    if (!language.display_name.trim()) errors.push(`Add a display name for "${code}".`)
  }

  if (!languages.some(language => language.enabled)) {
    errors.push('Keep at least one study language enabled.')
  }
  return errors
}

export function primaryLanguageSubtag(code: string): string | null {
  return canonicalizeLanguageCode(code)?.split('-')[0]?.toLowerCase() ?? null
}

/**
 * Card Type などの language scope と entry の language を照合する。
 * scope なしは全 language、`zh` のような primary tag は `zh-TW` にも適用するが、
 * `zh-TW` のような具体 tag は別 variant (`zh-CN`) へ広げない。
 */
export function matchesLanguageScope(
  scopeCode: string | null | undefined,
  entryCode: string | null | undefined,
): boolean {
  if (!scopeCode || !entryCode) return true

  const scope = canonicalizeLanguageCode(scopeCode)
  const entry = canonicalizeLanguageCode(entryCode)
  if (!scope || !entry) {
    return scopeCode.trim().toLowerCase() === entryCode.trim().toLowerCase()
  }
  if (scope === entry) return true

  return !scope.includes('-')
    && primaryLanguageSubtag(scope) === primaryLanguageSubtag(entry)
}

/** Resolve an enabled configured language by exact tag, then deterministic base-language match. */
export function resolveStudyLanguage(
  code: string,
  languages: StudyLanguage[],
  currentCode?: string | null,
): StudyLanguage | null {
  const canonical = canonicalizeLanguageCode(code)
  if (!canonical) return null
  const enabled = languages.filter(language => language.enabled)
  const exact = enabled.find(language => canonicalizeLanguageCode(language.code) === canonical)
  if (exact) return exact

  const primary = primaryLanguageSubtag(canonical)
  const baseMatches = enabled.filter(language => primaryLanguageSubtag(language.code) === primary)
  if (baseMatches.length === 0) return null
  if (baseMatches.length === 1) return baseMatches[0]

  const currentCanonical = currentCode ? canonicalizeLanguageCode(currentCode) : null
  const current = currentCanonical
    ? baseMatches.find(language => canonicalizeLanguageCode(language.code) === currentCanonical)
    : undefined
  return current ?? [...baseMatches].sort((a, b) => a.sort_order - b.sort_order)[0]
}

export function languageDisplayName(code: string, languages: StudyLanguage[]): string {
  const canonical = canonicalizeLanguageCode(code)
  const configured = canonical
    ? languages.find(language => canonicalizeLanguageCode(language.code) === canonical)
    : undefined
  return configured?.display_name ?? inferLanguageDisplayName(code)
}

function languageKey(code: string): string {
  return canonicalizeLanguageCode(code)?.toLowerCase() ?? code.trim().toLowerCase()
}

/**
 * Reconcile a stale Settings draft with the latest server list before saving.
 * The draft wins for every code it knew about (rename/enable/disable/reorder/delete),
 * but languages that appeared on the server AFTER the draft's baseline was captured
 * (e.g. added from the Create flow in another tab) are preserved and appended.
 */
export function mergeStudyLanguageEdits(
  baselineCodes: readonly string[],
  draft: StudyLanguage[],
  server: StudyLanguage[],
): StudyLanguage[] {
  const baseline = new Set(baselineCodes.map(languageKey))
  const drafted = new Set(draft.map(language => languageKey(language.code)))
  const preserved = server.filter(language => {
    const key = languageKey(language.code)
    return !baseline.has(key) && !drafted.has(key)
  })
  return [...draft, ...preserved].map((language, index) => ({ ...language, sort_order: index }))
}

/** Add a new language or re-enable an existing exact tag without overwriting its custom name. */
export function addOrEnableStudyLanguage(
  languages: StudyLanguage[],
  candidate: Pick<StudyLanguage, 'code' | 'display_name'>,
): StudyLanguage[] {
  const code = canonicalizeLanguageCode(candidate.code)
  if (!code) throw new Error(`Invalid BCP 47 language code: ${candidate.code}`)

  const existingIndex = languages.findIndex(
    language => canonicalizeLanguageCode(language.code) === code,
  )
  if (existingIndex >= 0) {
    return languages.map((language, index) => (
      index === existingIndex ? { ...language, enabled: true } : { ...language }
    ))
  }

  return [
    ...languages.map(language => ({ ...language })),
    {
      code,
      display_name: candidate.display_name.trim() || inferLanguageDisplayName(code),
      enabled: true,
      sort_order: languages.length,
    },
  ]
}
