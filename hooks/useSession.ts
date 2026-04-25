"use client";

import { useState, useEffect, useCallback } from 'react';
import { FormType } from '@/types';
import { loadSession, saveSession, clearSession, resetContentFields, SessionState } from '@/lib/session';

export function useSession(formType: FormType) {
  const [session, setSessionState] = useState<SessionState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initialSession = loadSession(formType);
    if (initialSession) {
      setSessionState(initialSession);
    }
    setIsLoaded(true);
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

  const resetContent = useCallback(() => {
    const newSession = resetContentFields(formType);
    setSessionState(newSession || null);
  }, [formType]);

  return {
    session,
    isLoaded,
    updateSession,
    clear,
    resetContent
  };
}
