"use client";

import { useState, useEffect, useCallback } from 'react';
import { FormType } from '@/types';
import {
  loadSession,
  saveSession,
  clearSession,
  resetContentFields,
} from '@/lib/session';
import type {
  ResetContentFieldsOptions,
  SessionState,
} from '@/lib/session';

export function useSession(formType: FormType | string) {
  const [session, setSessionState] = useState<SessionState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const data = loadSession(formType);
      setSessionState(data);
      setIsLoaded(true);
    }
    void load();
  }, [formType]);

  const updateSession = useCallback((data: Partial<SessionState>) => {
    setSessionState(prev => {
      const newState = { ...(prev || {}), ...data };
      saveSession(formType, newState);
      return newState;
    });
  }, [formType]);

  const clear = useCallback(() => {
    clearSession(formType);
    setSessionState(null);
  }, [formType]);

  const updateFieldValue = useCallback((key: string, value: string) => {
    setSessionState(prev => {
      const newState: SessionState = {
        ...(prev || {}),
        fieldValues: { ...(prev?.fieldValues || {}), [key]: value },
      };
      saveSession(formType, newState);
      return newState;
    });
  }, [formType]);

  const resetContent = useCallback((options?: ResetContentFieldsOptions) => {
    const newSession = resetContentFields(formType, options);
    setSessionState(newSession || null);
  }, [formType]);

  return {
    session,
    isLoaded,
    updateSession,
    updateFieldValue,
    clear,
    resetContent
  };
}
