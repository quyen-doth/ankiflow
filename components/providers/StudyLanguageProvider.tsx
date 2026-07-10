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
import type { StudyLanguage } from '@/types'

interface StudyLanguageContextValue {
  languages: StudyLanguage[]
  enabledLanguages: StudyLanguage[]
  loading: boolean
  saveLanguages: (languages: StudyLanguage[]) => Promise<StudyLanguage[]>
  addOrEnableLanguage: (
    language: Pick<StudyLanguage, 'code' | 'display_name'>,
  ) => Promise<StudyLanguage>
}

const DEFAULT_LANGUAGES = DEFAULT_STUDY_LANGUAGES.map(language => ({ ...language }))

const StudyLanguageContext = createContext<StudyLanguageContextValue>({
  languages: DEFAULT_LANGUAGES,
  enabledLanguages: DEFAULT_LANGUAGES,
  loading: true,
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
  const [loadedUid, setLoadedUid] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    return onSnapshot(
      doc(db, 'settings', user.uid),
      snapshot => {
        const data = snapshot.exists() ? snapshot.data() : undefined
        setLanguages(normalizeStudyLanguages(data?.study_languages))
        setLoadedUid(user.uid)
      },
      error => {
        console.error('Error loading study languages:', error)
        setLanguages(DEFAULT_LANGUAGES.map(language => ({ ...language })))
        setLoadedUid(user.uid)
      },
    )
  }, [authLoading, user])

  const effectiveLanguages = !user || loadedUid !== user.uid
    ? DEFAULT_LANGUAGES
    : languages
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
    loading,
    saveLanguages,
    addOrEnableLanguage,
  }), [effectiveLanguages, loading, saveLanguages, addOrEnableLanguage])

  return <StudyLanguageContext.Provider value={value}>{children}</StudyLanguageContext.Provider>
}

export function useStudyLanguages(): StudyLanguageContextValue {
  return useContext(StudyLanguageContext)
}
