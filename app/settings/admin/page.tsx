'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { FieldWrapper, Input, Select } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Plug, Brain, Bell, Check, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { SectionHeader } from '@/components/settings/SettingsPrimitives';
import { useAuth } from '@/components/providers/AuthProvider';
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants';
import {
    DEFAULT_LINE_WORDS_PER_NOTIFICATION,
    parseLineWordsPerNotification,
} from '@/lib/notifications/config';
import {
    createAdminSettingsSnapshot,
    type AiConfigForm,
    type FeatureFlagsForm,
    type LineConfigForm,
} from '@/lib/settings-form-state';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/utils';
import type { GlobalSettings } from '@/types';

/**
 * Trang Settings TOÀN CỤC (admin-only) — cấu hình ảnh hưởng MỌI account:
 * - `settings/global` (feature flags + AI + LINE schedule): CHỈ ghi được qua
 *   POST /api/admin/global-config (verify admin server-side).
 * - LINE channel credentials は server environment variables で管理する。
 *
 * Preferences cá nhân (settings/{uid}) nằm ở `/settings`. Trang này KHÔNG đụng settings/{uid}.
 */

const CLAUDE_MODEL_OPTIONS = [
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
];

export default function AdminSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const isAdmin = !!user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    const [featureFlags, setFeatureFlags] = useState<FeatureFlagsForm>({
        tts_available: true,
        unsplash_available: true,
    });
    const [aiConfig, setAiConfig] = useState<AiConfigForm>({ ai_model: 'claude-haiku-4-5', web_search_enabled: false });
    const [lineConfig, setLineConfig] = useState<LineConfigForm>({
        line_notifications_available: true,
        line_schedule_hours: [],
    });
    const [lineWordsInput, setLineWordsInput] = useState(String(DEFAULT_LINE_WORDS_PER_NOTIFICATION));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

    // UI-gate: non-admin không được xem trang này (bảo mật ghi vẫn do API/Firestore Rules lo).
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/settings');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (authLoading || !user || !isAdmin) return;
        async function fetchGlobal() {
            try {
                const globalSnap = await getDoc(doc(db, 'settings', GLOBAL_SETTINGS_DOC_ID));
                const g = (globalSnap.exists() ? globalSnap.data() : {}) as Partial<GlobalSettings>;

                const loadedFeatureFlags = {
                    tts_available: g.tts_available ?? true,
                    unsplash_available: g.unsplash_available ?? true,
                };
                const loadedAiConfig = {
                    ai_model: g.ai_model ?? 'claude-haiku-4-5',
                    web_search_enabled: g.web_search_enabled ?? false,
                };
                const loadedLineConfig = {
                    line_notifications_available: g.line_notifications_available ?? true,
                    line_schedule_hours: g.line_schedule_hours ?? [],
                };
                const configuredWords = g.line_words_per_notification;
                const loadedLineWordsInput = String(
                    typeof configuredWords === 'number' && configuredWords >= 1 && configuredWords <= 10
                        ? configuredWords
                        : DEFAULT_LINE_WORDS_PER_NOTIFICATION,
                );

                setFeatureFlags(loadedFeatureFlags);
                setAiConfig(loadedAiConfig);
                setLineConfig(loadedLineConfig);
                setLineWordsInput(loadedLineWordsInput);
                setSavedSnapshot(createAdminSettingsSnapshot({
                    featureFlags: loadedFeatureFlags,
                    aiConfig: loadedAiConfig,
                    lineConfig: loadedLineConfig,
                    lineWordsInput: loadedLineWordsInput,
                }));
            } catch (error) {
                console.error('Error fetching global settings:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchGlobal();
    }, [user, authLoading, isAdmin]);

    const updateFlag = useCallback(<K extends keyof FeatureFlagsForm>(field: K, value: boolean) => {
        setSavedAt(null);
        setFeatureFlags((prev) => ({ ...prev, [field]: value }));
    }, []);

    const updateAi = useCallback(<K extends keyof AiConfigForm>(field: K, value: AiConfigForm[K]) => {
        setSavedAt(null);
        setAiConfig((prev) => ({ ...prev, [field]: value }));
    }, []);

    const updateLine = useCallback(<K extends keyof LineConfigForm>(field: K, value: LineConfigForm[K]) => {
        setSavedAt(null);
        setLineConfig((prev) => ({ ...prev, [field]: value }));
    }, []);

    const toggleScheduleHour = useCallback((hour: number) => {
        setSavedAt(null);
        setLineConfig((prev) => ({
            ...prev,
            line_schedule_hours: prev.line_schedule_hours.includes(hour)
                ? prev.line_schedule_hours.filter((value) => value !== hour)
                : [...prev.line_schedule_hours, hour].sort((a, b) => a - b),
        }));
    }, []);

    const parsedLineWords = parseLineWordsPerNotification(lineWordsInput);
    const lineWordsError = parsedLineWords === null
        ? 'Enter a whole number from 1 to 10.'
        : undefined;

    const currentSnapshot = createAdminSettingsSnapshot({
        featureFlags,
        aiConfig,
        lineConfig,
        lineWordsInput,
    });
    const hasChanges = savedSnapshot !== null && currentSnapshot !== savedSnapshot;
    useUnsavedChangesGuard(hasChanges);

    const handleSave = async () => {
        if (!isAdmin || !hasChanges) return;
        if (parsedLineWords === null) {
            toast.error('Check Words per notification before saving.');
            return;
        }
        setSaving(true);
        try {
            // Feature flags + AI TOÀN CỤC → settings/global — BẮT BUỘC qua server API
            // (verify admin server-side; client không thể tự setDoc doc này).
            const res = await fetch('/api/admin/global-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ai_model: aiConfig.ai_model,
                    web_search_enabled: aiConfig.web_search_enabled,
                    tts_available: featureFlags.tts_available,
                    unsplash_available: featureFlags.unsplash_available,
                    line_notifications_available: lineConfig.line_notifications_available,
                    line_schedule_hours: lineConfig.line_schedule_hours,
                    line_words_per_notification: parsedLineWords,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save global config');
            }
            setSavedSnapshot(currentSnapshot);
            setSavedAt(Date.now());
            toast.success('App settings saved');
        } catch (error) {
            console.error('Error saving global settings:', error);
            toast.error('Failed to save app settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading || !isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    return (
        <>
            <PageHeader
                title="App Settings"
                description="Configuration that applies to every account. Admin only."
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/settings">
                            <Button variant="ghost" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                                Personal settings
                            </Button>
                        </Link>
                        <Button
                            variant="primary"
                            leftIcon={<Check className="w-4 h-4" />}
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                        >
                            {saving ? 'Saving...' : 'Save changes'}
                        </Button>
                    </div>
                }
            />

            <div className="max-w-3xl mx-auto w-full pb-12 flex flex-col gap-8">
                {/* Feature availability — ảnh hưởng MỌI user ngay lập tức */}
                <Card>
                    <SectionHeader icon={Plug} label="Feature availability (all users)" tone="amber" />
                    <p className="text-sm text-slate-600 mb-3.5">
                        Turning a feature off blocks it for every account immediately (enforced server-side). Turning it
                        back on restores each user&apos;s own preference — it does not force it on for everyone.
                    </p>
                    <div className="flex flex-col">
                        <div className="py-[15px] border-b border-[#f5f5f1]">
                            <Toggle
                                bare
                                label="Text-to-speech available"
                                description="Allow any user to generate audio pronunciation via Google Cloud TTS."
                                checked={featureFlags.tts_available}
                                onChange={(v) => updateFlag('tts_available', v)}
                            />
                        </div>
                        <div className="py-[15px]">
                            <Toggle
                                bare
                                label="Unsplash image search available"
                                description="Allow any user to search illustration images via Unsplash."
                                checked={featureFlags.unsplash_available}
                                onChange={(v) => updateFlag('unsplash_available', v)}
                            />
                        </div>
                    </div>
                </Card>

                {/* AI generation — ai_model/web_search ảnh hưởng chi phí API của chủ app */}
                <Card>
                    <SectionHeader icon={Brain} label="AI generation" tone="amber" />
                    <FieldWrapper label="Claude Model">
                        <Select value={aiConfig.ai_model} onChange={(e) => updateAi('ai_model', e.target.value)}>
                            {CLAUDE_MODEL_OPTIONS.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </Select>
                    </FieldWrapper>
                    <div className="mt-3.5 flex items-center p-[14px] border border-[#eceae4] rounded-[11px] bg-[#fcfcfb]">
                        <Toggle
                            bare
                            label="Enable web search"
                            description="Allow AI agent to search the web for verification (slower and more expensive)"
                            checked={aiConfig.web_search_enabled}
                            onChange={(v) => updateAi('web_search_enabled', v)}
                        />
                    </div>
                </Card>

                {/* LINE 通知の可用性と全 user 共通の配信ルール。 */}
                <Card>
                    <SectionHeader icon={Bell} label="Notifications" tone="amber" />
                    <p className="text-[12.5px] text-slate-500 mb-3.5">
                        Channel credentials are configured via server environment variables.
                    </p>
                    <div className="flex flex-col gap-4">
                        <div className="py-[15px] border-b border-[#f5f5f1]">
                            <Toggle
                                bare
                                label="LINE reminders available (all users)"
                                description="Allow users to link LINE and receive vocabulary review reminders."
                                checked={lineConfig.line_notifications_available}
                                onChange={(v) => updateLine('line_notifications_available', v)}
                            />
                        </div>

                        <FieldWrapper label="Reminder hours (user local time)">
                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                                {Array.from({ length: 24 }, (_, hour) => {
                                    const selected = lineConfig.line_schedule_hours.includes(hour);
                                    return (
                                        <button
                                            key={hour}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => toggleScheduleHour(hour)}
                                            className={cn(
                                                'h-9 rounded-[8px] border font-mono text-[12px] font-bold transition-colors',
                                                selected
                                                    ? 'border-primary bg-primary text-white'
                                                    : 'border-[#e3e3de] bg-[#fcfcfb] text-slate-500 hover:border-primary/50 hover:text-primary',
                                            )}
                                        >
                                            {String(hour).padStart(2, '0')}:00
                                        </button>
                                    );
                                })}
                            </div>
                        </FieldWrapper>

                        <FieldWrapper label="Words per notification" error={lineWordsError}>
                            <Input
                                aria-label="Words per notification"
                                type="number"
                                min={1}
                                max={10}
                                value={lineWordsInput}
                                error={lineWordsError !== undefined}
                                onChange={(event) => {
                                    setSavedAt(null);
                                    setLineWordsInput(event.target.value);
                                }}
                                className="max-w-32 font-mono"
                            />
                        </FieldWrapper>
                    </div>
                </Card>

                {savedAt && <p className="text-overline text-slate-600 text-center">Saved successfully.</p>}
            </div>
        </>
    );
}
