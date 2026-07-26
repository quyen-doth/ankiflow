import type { Entry } from '@/types'

export interface DashboardStats {
  total_vocabulary: number
  total_cards: number
  created_today: number
  synced: number
}

export interface DashboardLanguageCount {
  language: string
  count: number
}

export interface DashboardRecentEntry {
  id: string
  form_type: string
  language?: string
  word?: string
  term?: string
  title?: string
  meaning_vi?: string
  definition?: string
  content?: string
  status: Entry['status']
}

export interface DashboardResponse {
  stats: DashboardStats
  language_counts: DashboardLanguageCount[]
  recent_entries: DashboardRecentEntry[]
}
