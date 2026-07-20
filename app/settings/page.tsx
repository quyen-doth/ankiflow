'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import {
    Monitor,
    Sparkles,
    Volume2,
    ImageIcon,
    SlidersHorizontal,
    Plug,
    Check,
    RefreshCw,
    Copy,
    Wrench,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ResyncCards } from '@/components/settings/ResyncCards';
import { LineNotificationSettings } from '@/components/settings/LineNotificationSettings';
import { SectionHeader, IntegrationCard } from '@/components/settings/SettingsPrimitives';
import { StudyLanguageSettings } from '@/components/settings/StudyLanguageSettings';
import { ContentTypeManager } from '@/components/admin/ContentTypeManager';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { useAuth } from '@/components/providers/AuthProvider';
import { useGlobalConfig } from '@/components/providers/GlobalConfigProvider';
import { cn } from '@/lib/utils';
import { getAnkiClientFromSettings, resetAnkiClientCache } from '@/lib/flashcard-service/client';
import {
    canonicalizeLanguageCode,
    mergeStudyLanguageEdits,
    normalizeStudyLanguages,
    validateStudyLanguages,
} from '@/lib/studyLanguages';
import { createPersonalSettingsSnapshot } from '@/lib/settings-form-state';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { Settings } from '@/types';

/**
 * 個人設定ページ — 全ユーザー対象 (per-user preferences は `settings/{uid}`):
 * SRS sync・カードレイアウト更新・連携状態・unsplash/tts/auto_audio/auto_image/
 * allow_duplicate の各トグル + anki_connect_url。初回 Save で doc を自動作成する。
 *
 * アプリ所有者のグローバル設定 (feature availability・AI model・LINE 通知) は
 * `/settings/admin` (admin 専用) に分離済み — このページは `settings/default` を
 * 読まない (LINE token 漏洩防止) し、`settings/global` にも書き込まない。
 */

/**
 * このページから Anki に到達できない場合の案内 callout。browser は CORS の詳細を JS から
 * 隠すため、「Anki 未起動」と「CORS 未許可」は同じ症状になる → 両方をまとめて案内する。
 */
function AnkiCorsHelp({ onRecheck }: { onRecheck: () => Promise<boolean> }) {
    // checkingAnki=false (client-side 確定後) にのみ mount される → origin は lazy init で読めて effect 不要。
    const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));
    const [copied, setCopied] = useState(false);
    const [rechecking, setRechecking] = useState(false);

    // デプロイ版 (loopback 以外の origin) では browser の Local Network Access が
    // public→localhost をブロックする → CORS を直しても届かないため別途案内する。
    const isDeployedOrigin = typeof window !== 'undefined'
        && !['localhost', '127.0.0.1'].includes(window.location.hostname);

    const snippet = `{\n  "webCorsOriginList": ["http://localhost", "${origin}"]\n}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(origin);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard 使用不可 — 無視 */
        }
    };

    const handleRecheck = async () => {
        setRechecking(true);
        try {
            await onRecheck();
        } finally {
            setRechecking(false);
        }
    };

    return (
        <div className="p-[14px] border border-[#f0e4cc] rounded-[11px] bg-[#fdfbf5]">
            <p className="text-[13px] font-bold text-[#b87514] mb-1.5">Anki not reachable from this page</p>
            <p className="text-[12.5px] text-slate-600 leading-relaxed mb-3">
                Make sure Anki Desktop is open, and that AnkiConnect allows this page&apos;s origin. In Anki, go to{' '}
                <span className="font-semibold">Tools → Add-ons → AnkiConnect → Config</span>, add your origin to{' '}
                <code className="px-1 py-0.5 rounded bg-[#f3ecdd] font-mono text-[11px]">webCorsOriginList</code>, then
                restart Anki:
            </p>
            <pre className="mb-3 px-3 py-2.5 rounded-[8px] bg-white border border-[#eceae4] font-mono text-[11.5px] text-ink overflow-x-auto whitespace-pre">
                {snippet}
            </pre>
            <div className="flex items-center gap-2 flex-wrap">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopy}
                    leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                >
                    {copied ? 'Copied origin' : 'Copy origin'}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRecheck}
                    disabled={rechecking}
                    leftIcon={<RefreshCw className={cn('w-3.5 h-3.5', rechecking && 'animate-spin')} />}
                >
                    {rechecking ? 'Checking…' : 'Recheck'}
                </Button>
            </div>
            {isDeployedOrigin && (
                <div className="mt-3 p-2.5 rounded-[8px] bg-white border border-[#eceae4]">
                    <p className="text-[11.5px] text-slate-600 leading-relaxed">
                        <span className="font-bold text-[#b87514]">Still blocked after allowing CORS?</span>{' '}
                        Modern browsers (Chrome &quot;Local Network Access&quot;) block a deployed site from reaching{' '}
                        <code className="px-1 py-0.5 rounded bg-[#f3ecdd] font-mono text-[11px]">localhost</code>. When
                        prompted, allow local network access for this site — or run AnkiFlow at{' '}
                        <code className="px-1 py-0.5 rounded bg-[#f3ecdd] font-mono text-[11px]">http://localhost:3000</code>{' '}
                        to sync with Anki.
                    </p>
                </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2.5">
                Note: Safari blocks requests from HTTPS pages to localhost — use Chrome, Edge, or Firefox for the
                deployed app.
            </p>
        </div>
    );
}

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const { config: globalConfig } = useGlobalConfig();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [ankiConnected, setAnkiConnected] = useState(false);
    const [checkingAnki, setCheckingAnki] = useState(true);
    const [syncingSRS, setSyncingSRS] = useState(false);
    // ページ読み込み時点の study_languages code 一覧 — ページを開いている間に
    // 別フロー (Create flow) から追加された言語を検出するための基準点。
    const baselineLanguageCodesRef = useRef<string[]>([]);
    const toast = useToast();

    const isAdmin = !!user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    useEffect(() => {
        if (authLoading || !user) return;
        async function fetchSettings(uid: string) {
            try {
                // 個人 prefs のみ読む。グローバル feature flags (ai_model/tts_available/
                // unsplash_available) は GlobalConfigProvider が realtime 提供済み —
                // ここで settings/global は読まない。settings/default (admin secrets) も読まない。
                const userSnap = await getDoc(doc(db, 'settings', uid));
                const prefs = (userSnap.exists() ? userSnap.data() : {}) as Partial<Settings>;
                const studyLanguages = normalizeStudyLanguages(prefs.study_languages);
                const aiOutputLanguage = typeof prefs.ai_output_language === 'string'
                    ? canonicalizeLanguageCode(prefs.ai_output_language) ?? 'vi'
                    : 'vi';
                baselineLanguageCodesRef.current = studyLanguages.map((language) => language.code);
                const loadedSettings = {
                    ...prefs,
                    study_languages: studyLanguages,
                    ai_output_language: aiOutputLanguage,
                } as Settings;
                setSettings(loadedSettings);
                setSavedSnapshot(createPersonalSettingsSnapshot(loadedSettings));
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchSettings(user.uid);
    }, [user, authLoading]);

    const handleSyncSrs = useCallback(async () => {
        setSyncingSRS(true);
        try {
            // 1. synced 済み entry の note ids を取得 (server は Anki に触れない)。
            const getRes = await fetch('/api/anki/sync-srs', { cache: 'no-store' });
            const { noteIds } = await getRes.json();
            if (!noteIds || noteIds.length === 0) {
                toast.success('No cards to sync');
                return;
            }

            // 2. user の Anki から SRS 状態を読む (browser → AnkiConnect)。
            //    Anki search は nid:id1,id2,... をサポート → note ごとに round-trip せず
            //    chunk 単位でまとめて query (500 枚 = 500 ではなく 1-2 request)。
            const client = await getAnkiClientFromSettings();
            const CHUNK = 500;
            const chunks: number[][] = [];
            for (let i = 0; i < noteIds.length; i += CHUNK) {
                chunks.push(noteIds.slice(i, i + CHUNK));
            }
            const cardIdChunks = await Promise.all(chunks.map((chunk) => client.findCards(`nid:${chunk.join(',')}`)));
            const allCardIds = cardIdChunks.flat();
            if (allCardIds.length === 0) {
                toast.success('No cards found in Anki');
                return;
            }
            const cardsInfo = await client.cardsInfo(allCardIds);

            // 3. server に送って ReviewState を map + Firestore を更新。
            const postRes = await fetch('/api/anki/sync-srs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cards: cardsInfo }),
            });
            const data = await postRes.json();
            if (data.success) {
                toast.success(`Synced ${data.synced} of ${data.total} entries`);
            } else {
                toast.error(data.error ?? 'Sync failed');
            }
        } catch {
            toast.error('Failed to sync SRS data.');
        } finally {
            setSyncingSRS(false);
        }
    }, [toast]);

    // callout 内ボタン用の Recheck — checkingAnki は立てない (callout が途中で unmount されるのを防ぐ)。
    const recheckAnki = useCallback(async (): Promise<boolean> => {
        try {
            const client = await getAnkiClientFromSettings();
            const { connected } = await client.ping();
            setAnkiConnected(connected);
            return connected;
        } catch {
            setAnkiConnected(false);
            return false;
        }
    }, []);

    useEffect(() => {
        (async () => {
            await recheckAnki();
            setCheckingAnki(false);
        })();
    }, [recheckAnki]);

    const updateField = useCallback(<K extends keyof Settings>(field: K, value: Settings[K]) => {
        setSavedAt(null);
        setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
    }, []);

    const currentSnapshot = settings ? createPersonalSettingsSnapshot(settings) : null;
    const hasChanges = savedSnapshot !== null && currentSnapshot !== savedSnapshot;
    useUnsavedChangesGuard(hasChanges);

    const handleSave = async () => {
        if (!settings || !user || !hasChanges) return;
        const languageErrors = validateStudyLanguages(settings.study_languages ?? []);
        if (languageErrors.length > 0) {
            toast.error(languageErrors[0]);
            return;
        }
        setSaving(true);
        try {
            // 最新版を再読込し、このページを開いている間に別フロー (Create flow の
            // DetectedLanguageModal など) で追加された言語を上書きで失わないようにする。
            const freshSnap = await getDoc(doc(db, 'settings', user.uid));
            const serverLanguages = normalizeStudyLanguages(
                freshSnap.exists() ? freshSnap.data()?.study_languages : undefined,
            );
            const mergedLanguages = normalizeStudyLanguages(mergeStudyLanguageEdits(
                baselineLanguageCodesRef.current,
                settings.study_languages ?? [],
                serverLanguages,
            ));

            // 個人 preferences → settings/{uid} (初回 save で自動作成)。
            const prefsUpdate = {
                unsplash_enabled: settings.unsplash_enabled,
                tts_enabled: settings.tts_enabled,
                auto_audio: settings.auto_audio,
                auto_image: settings.auto_image,
                allow_duplicate: settings.allow_duplicate,
                anki_connect_url: settings.anki_connect_url,
                study_languages: mergedLanguages,
                ai_output_language: canonicalizeLanguageCode(settings.ai_output_language ?? '') ?? 'vi',
            };
            await setDoc(
                doc(db, 'settings', user.uid),
                { ...prefsUpdate, updated_at: serverTimestamp() },
                { merge: true },
            );
            baselineLanguageCodesRef.current = mergedLanguages.map((language) => language.code);
            const savedSettings = {
                ...settings,
                study_languages: mergedLanguages,
                ai_output_language: prefsUpdate.ai_output_language,
            };
            setSettings(savedSettings);
            setSavedSnapshot(createPersonalSettingsSnapshot(savedSettings));

            resetAnkiClientCache();
            setSavedAt(Date.now());
            toast.success('Settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center max-w-md">
                    <p className="text-lg font-semibold text-ink mb-2">Settings not found</p>
                    <p className="text-sm text-slate-600">
                        Run <code className="px-1.5 py-0.5 rounded-md bg-surface text-ink">npm run seed</code> to
                        initialize the settings document.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageHeader
                title="Settings"
                description="Manage your integrations and personal preferences."
                actions={
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <Link href="/settings/admin">
                                <Button variant="ghost" leftIcon={<Wrench className="w-4 h-4" />}>
                                    App settings
                                </Button>
                            </Link>
                        )}
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
                {/* SRS Sync */}
                <Card>
                    <SectionHeader icon={RefreshCw} label="SRS Data Sync" tone="green" />
                    <p className="text-sm text-slate-600 mb-4">
                        Sync spaced repetition data from Anki Desktop to Firestore. Requires Anki Desktop to be open.
                    </p>
                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<RefreshCw className={cn('w-4 h-4', syncingSRS && 'animate-spin')} />}
                        disabled={syncingSRS || !ankiConnected}
                        onClick={handleSyncSrs}
                    >
                        {syncingSRS ? 'Syncing...' : 'Sync SRS from Anki'}
                    </Button>
                    {!ankiConnected && (
                        <p className="text-xs text-slate-400 mt-2">Anki Desktop must be running to sync.</p>
                    )}
                </Card>

                {/* Re-sync card layout */}
                <Card>
                    <SectionHeader icon={RefreshCw} label="Update Card Layout" tone="amber" />
                    <ResyncCards ankiConnected={ankiConnected} />
                </Card>

                {/* Per-user study languages */}
                <Card>
                    <StudyLanguageSettings
                        languages={settings.study_languages ?? []}
                        onChange={(languages) => updateField('study_languages', languages)}
                    />
                </Card>

                {/* Workspace-owned Create form configuration. */}
                <ContentTypeManager />

                {/* Integrations */}
                <Card>
                    <SectionHeader icon={Plug} label="Integrations" tone="green" />
                    <div className="flex flex-col gap-2.5">
                        <IntegrationCard
                            label="Anki Desktop"
                            description="Local AnkiConnect plugin at localhost:8765"
                            icon={Monitor}
                            tone="green"
                            connected={ankiConnected}
                            checking={checkingAnki}
                        />
                        {!checkingAnki && !ankiConnected && <AnkiCorsHelp onRecheck={recheckAnki} />}
                        <IntegrationCard
                            label="Claude API"
                            description={globalConfig.ai_model}
                            icon={Sparkles}
                            tone="amber"
                            descMono
                            connected
                            checking={false}
                        />
                        <IntegrationCard
                            label="Google Cloud TTS"
                            description={
                                !globalConfig.tts_available
                                    ? 'Disabled by administrator'
                                    : settings.tts_enabled ? 'Audio generation enabled' : 'Audio generation disabled'
                            }
                            icon={Volume2}
                            tone="green"
                            connected={globalConfig.tts_available && settings.tts_enabled}
                            checking={false}
                        />
                        <IntegrationCard
                            label="Unsplash"
                            description={
                                !globalConfig.unsplash_available
                                    ? 'Disabled by administrator'
                                    : settings.unsplash_enabled ? 'Image search enabled' : 'Image search disabled'
                            }
                            icon={ImageIcon}
                            tone="green"
                            connected={globalConfig.unsplash_available && settings.unsplash_enabled}
                            checking={false}
                        />
                    </div>
                </Card>

                {/* Preferences */}
                <Card>
                    <SectionHeader icon={SlidersHorizontal} label="Preferences" tone="green" />
                    <div className="flex flex-col">
                        <div className="pb-[15px] border-b border-[#f5f5f1]">
                            <div className="mb-3">
                                <p className="text-sm font-semibold text-ink">AI output language</p>
                                <p className="text-[12.5px] text-slate-500 mt-0.5">
                                    Meanings and translations on generated cards are written in this language.
                                </p>
                            </div>
                            <LanguagePicker
                                value={settings.ai_output_language ?? 'vi'}
                                onChange={(language) => updateField('ai_output_language', language.code)}
                            />
                        </div>
                        {(
                            [
                                {
                                    key: 'unsplash_enabled',
                                    label: 'Enable Unsplash images',
                                    description: 'Search for illustration images when generating cards.',
                                },
                                {
                                    key: 'tts_enabled',
                                    label: 'Enable text-to-speech',
                                    description: 'Generate native audio pronunciation for vocabulary.',
                                },
                                {
                                    key: 'auto_audio',
                                    label: 'Auto-generate audio',
                                    description: 'Automatically request audio when a card is generated.',
                                },
                                {
                                    key: 'auto_image',
                                    label: 'Auto-fetch images',
                                    description:
                                        'Automatically search for illustration images when a card is generated.',
                                },
                                {
                                    key: 'allow_duplicate',
                                    label: 'Allow duplicate entries',
                                    description: 'Permit creating cards for vocabulary that already exists.',
                                },
                            ] as const
                        ).map((pref) => (
                            <div key={pref.key} className="py-[15px] border-b border-[#f5f5f1] last:border-b-0">
                                <Toggle
                                    bare
                                    label={pref.label}
                                    description={pref.description}
                                    checked={settings[pref.key]}
                                    onChange={(v) => updateField(pref.key, v)}
                                />
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Per-user LINE account linking and reminder preference. */}
                <Card>
                    <LineNotificationSettings />
                </Card>

                {savedAt && <p className="text-overline text-slate-600 text-center">Saved successfully.</p>}
            </div>
        </>
    );
}
