import { FormType } from "@/types";

export interface SessionState {
  categoryId?: string;
  language?: string;
  deckId?: string;
  cardTypeIds?: string[];
  topicIds?: string[];
  difficulty?: string;
  tags?: string[];
  [key: string]: any;
}

const getStorageKey = (formType: FormType) => `ankiflow_session_${formType}`;

export const saveSession = (formType: FormType, data: SessionState) => {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadSession(formType) || {};
    const updated = { ...existing, ...data };
    localStorage.setItem(getStorageKey(formType), JSON.stringify(updated));
  } catch (e) {
    console.error("Error saving session", e);
  }
};

export const loadSession = (formType: FormType): SessionState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(getStorageKey(formType));
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error("Error loading session", e);
    return null;
  }
};

export const clearSession = (formType: FormType) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getStorageKey(formType));
};

export const resetContentFields = (formType: FormType) => {
  if (typeof window === 'undefined') return;
  const current = loadSession(formType);
  if (!current) return;

  const preservedFields = ['categoryId', 'language', 'deckId', 'cardTypeIds', 'topicIds', 'difficulty', 'tags'];
  const newSession: SessionState = {};

  preservedFields.forEach(field => {
    if (current[field] !== undefined) {
      newSession[field] = current[field];
    }
  });

  localStorage.setItem(getStorageKey(formType), JSON.stringify(newSession));
  return newSession;
};
