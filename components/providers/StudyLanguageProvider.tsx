'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  DEFAULT_STUDY_LANGUAGES,
  addOrEnableStudyLanguage,
  canonicalizeLanguageCode,
  normalizeStudyLanguages,
  validateStudyLanguages,
} from '@/lib/studyLanguages'
import {
  DEFAULT_AI_OUTPUT_LANGUAGE_CODE,
  DEFAULT_AI_OUTPUT_LANGUAGES,
  normalizeAiOutputLanguagePreferences,
} from '@/lib/aiOutputLanguages'
import type { AiOutputLanguage, StudyLanguage } from '@/types'

export interface StudyLanguageContextValue {
  languages: StudyLanguage[]
  enabledLanguages: StudyLanguage[]
  aiOutputLanguages: AiOutputLanguage[]
  enabledAiOutputLanguages: AiOutputLanguage[]
  defaultAiOutputLanguage: string
  loading: boolean
  saveLanguages: (languages: StudyLanguage[]) => Promise<StudyLanguage[]>
  addOrEnableLanguage: (
    language: Pick<StudyLanguage, 'code' | 'display_name'>,
  ) => Promise<StudyLanguage>
}

const DEFAULT_LANGUAGES = DEFAULT_STUDY_LANGUAGES.map(language => ({ ...language }))
const DEFAULT_OUTPUT_LANGUAGES = DEFAULT_AI_OUTPUT_LANGUAGES.map(language => ({ ...language }))

export const StudyLanguageContext = createContext<StudyLanguageContextValue>({
  languages: DEFAULT_LANGUAGES,
  enabledLanguages: DEFAULT_LANGUAGES,
  aiOutputLanguages: DEFAULT_OUTPUT_LANGUAGES,
  enabledAiOutputLanguages: DEFAULT_OUTPUT_LANGUAGES,
  defaultAiOutputLanguage: DEFAULT_AI_OUTPUT_LANGUAGE_CODE,
  loading: false,
  saveLanguages: async () => {
    throw new Error('StudyLanguageProvider is not mounted')
  },
  addOrEnableLanguage: async () => {
    throw new Error('StudyLanguageProvider is not mounted')
  },
})

export function StudyLanguageProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, loading: authLoading } = useAuth()
  const [languages, setLanguages] = useState<StudyLanguage[]>(DEFAULT_LANGUAGES)
  const [aiOutputLanguages, setAiOutputLanguages] = useState<AiOutputLanguage[]>(
    DEFAULT_OUTPUT_LANGUAGES,
  )
  const [defaultAiOutputLanguage, setDefaultAiOutputLanguage] = useState(
    DEFAULT_AI_OUTPUT_LANGUAGE_CODE,
  )
  const [loadedUid, setLoadedUid] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    return onSnapshot(
      doc(db, 'settings', user.uid),
      snapshot => {
        const data = snapshot.exists() ? snapshot.data() : undefined
        const outputPreferences = normalizeAiOutputLanguagePreferences(
          data?.ai_output_languages,
          data?.ai_output_language,
        )
        setLanguages(normalizeStudyLanguages(data?.study_languages))
        setAiOutputLanguages(outputPreferences.languages)
        setDefaultAiOutputLanguage(outputPreferences.defaultLanguage)
        setLoadedUid(user.uid)
      },
      error => {
        console.error('Error loading study languages:', error)
        setLanguages(DEFAULT_LANGUAGES.map(language => ({ ...language })))
        setAiOutputLanguages(DEFAULT_OUTPUT_LANGUAGES.map(language => ({ ...language })))
        setDefaultAiOutputLanguage(DEFAULT_AI_OUTPUT_LANGUAGE_CODE)
        setLoadedUid(user.uid)
      },
    )
  }, [authLoading, user])

  const effectiveLanguages = !user || loadedUid !== user.uid
    ? DEFAULT_LANGUAGES
    : languages
  const effectiveAiOutputLanguages = !user || loadedUid !== user.uid
    ? DEFAULT_OUTPUT_LANGUAGES
    : aiOutputLanguages
  const effectiveDefaultAiOutputLanguage = !user || loadedUid !== user.uid
    ? DEFAULT_AI_OUTPUT_LANGUAGE_CODE
    : defaultAiOutputLanguage
  const loading = authLoading || (!!user && loadedUid !== user.uid)

  const saveLanguages = useCallback(async (nextLanguages: StudyLanguage[]): Promise<StudyLanguage[]> => {
    if (!user) throw new Error('Not signed in')
    const errors = validateStudyLanguages(nextLanguages)
    if (errors.length > 0) throw new Error(errors[0])

    const normalized = normalizeStudyLanguages(nextLanguages)
    const previous = languages
    setLanguages(normalized)
    try {
      await setDoc(
        doc(db, 'settings', user.uid),
        { study_languages: normalized, updated_at: serverTimestamp() },
        { merge: true },
      )
      return normalized
    } catch (error) {
      setLanguages(previous)
      throw error
    }
  }, [languages, user])

  const addOrEnableLanguage = useCallback(async (
    language: Pick<StudyLanguage, 'code' | 'display_name'>,
  ): Promise<StudyLanguage> => {
    const next = addOrEnableStudyLanguage(effectiveLanguages, language)
    const saved = await saveLanguages(next)
    const canonical = canonicalizeLanguageCode(language.code)
    const result = saved.find(item => canonicalizeLanguageCode(item.code) === canonical)
      ?? saved[saved.length - 1]
    return result
  }, [effectiveLanguages, saveLanguages])

  const value = useMemo<StudyLanguageContextValue>(() => ({
    languages: effectiveLanguages,
    enabledLanguages: effectiveLanguages.filter(language => language.enabled),
    aiOutputLanguages: effectiveAiOutputLanguages,
    enabledAiOutputLanguages: effectiveAiOutputLanguages.filter(language => language.enabled),
    defaultAiOutputLanguage: effectiveDefaultAiOutputLanguage,
    loading,
    saveLanguages,
    addOrEnableLanguage,
  }), [
    effectiveLanguages,
    effectiveAiOutputLanguages,
    effectiveDefaultAiOutputLanguage,
    loading,
    saveLanguages,
    addOrEnableLanguage,
  ])

  return <StudyLanguageContext.Provider value={value}>{children}</StudyLanguageContext.Provider>
}

export function useStudyLanguages(): StudyLanguageContextValue {
  return useContext(StudyLanguageContext)
}
