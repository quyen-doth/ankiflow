'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { FieldWrapper, Select } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Plug, Brain, Bell, MessageSquare, Check, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { SectionHeader, IntegrationCard } from '@/components/settings/SettingsPrimitives';
import { useAuth } from '@/components/providers/AuthProvider';
import { SETTINGS_DOC_ID, GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants';
import type { Settings } from '@/types';

/**
 * Trang Settings TOÀN CỤC (admin-only) — cấu hình ảnh hưởng MỌI account:
 * - `settings/global` (feature flags + AI): ai_model, web_search_enabled, tts_available,
 *   unsplash_available. CHỈ ghi được qua POST /api/admin/global-config (verify admin
 *   server-side — không thể bypass bằng setDoc trực tiếp).
 * - `settings/default` (SECRETS): LINE credentials + notifications_enabled. Ghi trực tiếp
 *   qua client SDK (interim — Phase D Security Rules sẽ khóa).
 *
 * Preferences cá nhân (settings/{uid}) nằm ở `/settings`. Trang này KHÔNG đụng settings/{uid}.
 */

interface FeatureFlagsForm {
    tts_available: boolean;
    unsplash_available: boolean;
}

interface AiConfigForm {
    ai_model: string;
    web_search_enabled: boolean;
}

interface LineSecretsForm {
    notifications_enabled: boolean;
    line_channel_access_token?: string;
    line_user_id?: string;
}

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
    const [lineSecrets, setLineSecrets] = useState<LineSecretsForm>({ notifications_enabled: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);

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
                const [globalSnap, defSnap] = await Promise.all([
                    getDoc(doc(db, 'settings', GLOBAL_SETTINGS_DOC_ID)),
                    getDoc(doc(db, 'settings', SETTINGS_DOC_ID)),
                ]);
                const g = (globalSnap.exists() ? globalSnap.data() : {}) as Partial<Settings> & {
                    tts_available?: boolean;
                    unsplash_available?: boolean;
                };
                const d = (defSnap.exists() ? defSnap.data() : {}) as Partial<Settings>;

                setFeatureFlags({
                    tts_available: g.tts_available ?? true,
                    unsplash_available: g.unsplash_available ?? true,
                });
                setAiConfig({
                    ai_model: g.ai_model ?? 'claude-haiku-4-5',
                    web_search_enabled: g.web_search_enabled ?? false,
                });
                setLineSecrets({
                    notifications_enabled: d.notifications_enabled ?? false,
                    line_channel_access_token: d.line_channel_access_token,
                    line_user_id: d.line_user_id,
                });
            } catch (error) {
                console.error('Error fetching global settings:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchGlobal();
    }, [user, authLoading, isAdmin]);

    const updateFlag = useCallback(<K extends keyof FeatureFlagsForm>(field: K, value: boolean) => {
        setFeatureFlags((prev) => ({ ...prev, [field]: value }));
    }, []);

    const updateAi = useCallback(<K extends keyof AiConfigForm>(field: K, value: AiConfigForm[K]) => {
        setAiConfig((prev) => ({ ...prev, [field]: value }));
    }, []);

    const updateLine = useCallback(<K extends keyof LineSecretsForm>(field: K, value: LineSecretsForm[K]) => {
        setLineSecrets((prev) => ({ ...prev, [field]: value }));
    }, []);

    const handleSave = async () => {
        if (!isAdmin) return;
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
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save global config');
            }

            // Secrets (LINE) → settings/default — client SDK trực tiếp (interim).
            await setDoc(
                doc(db, 'settings', SETTINGS_DOC_ID),
                {
                    notifications_enabled: lineSecrets.notifications_enabled,
                    line_channel_access_token: lineSecrets.line_channel_access_token,
                    line_user_id: lineSecrets.line_user_id,
                    updated_at: serverTimestamp(),
                },
                { merge: true },
            );

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
                            disabled={saving}
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

                {/* Notifications — LINE credentials là của chủ app */}
                <Card>
                    <SectionHeader icon={Bell} label="Notifications" tone="amber" />
                    <div className="flex flex-col gap-3.5">
                        <div className="py-[15px] border-b border-[#f5f5f1]">
                            <Toggle
                                bare
                                label="Enable notifications"
                                description="Send vocabulary review reminders via LINE."
                                checked={lineSecrets.notifications_enabled}
                                onChange={(v) => updateLine('notifications_enabled', v)}
                            />
                        </div>

                        <IntegrationCard
                            label="LINE Messaging"
                            description={lineSecrets.line_channel_access_token ? 'Token configured' : 'Not configured'}
                            icon={MessageSquare}
                            tone="amber"
                            connected={!!lineSecrets.line_channel_access_token}
                            checking={false}
                        />

                        <FieldWrapper label="LINE Channel Access Token">
                            <input
                                type="password"
                                value={lineSecrets.line_channel_access_token ?? ''}
                                onChange={(e) =>
                                    updateLine('line_channel_access_token', e.target.value || undefined)
                                }
                                placeholder="Paste your LINE Channel Access Token"
                                className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] px-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow font-mono"
                            />
                        </FieldWrapper>

                        <FieldWrapper label="LINE User ID">
                            <input
                                type="text"
                                value={lineSecrets.line_user_id ?? ''}
                                onChange={(e) => updateLine('line_user_id', e.target.value || undefined)}
                                placeholder="Your LINE User ID"
                                className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] px-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow font-mono"
                            />
                        </FieldWrapper>
                    </div>
                </Card>

                {savedAt && <p className="text-overline text-slate-600 text-center">Saved successfully.</p>}
            </div>
        </>
    );
}
